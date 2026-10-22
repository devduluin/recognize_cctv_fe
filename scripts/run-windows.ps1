param([switch] $Background, [switch] $Stop)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$hash = [Security.Cryptography.SHA256]::Create()
try { $projectKey = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($frontendRoot.ToLowerInvariant())))).Replace('-', '').Substring(0, 16) } finally { $hash.Dispose() }
$stateDirectory = Join-Path $env:LOCALAPPDATA "VisitorCounterRunner\$projectKey"
$stateFile = Join-Path $stateDirectory 'processes.json'
$script:ownedProcesses = @()

function Get-OwnedProcess($Record) {
    $candidate = Get-Process -Id $Record.Id -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.StartTime.ToUniversalTime().Ticks.ToString() -eq $Record.StartTicks) {
        return $candidate
    }
    return $null
}

function Get-OwnedTree($Records) {
    # Capture children before killing parents. Keep exact creation times so
    # an unrelated process reusing a PID can never be selected by a stale file.
    $owned = @{}
    $pending = New-Object System.Collections.Queue
    foreach ($record in $Records) {
        $process = Get-OwnedProcess $record
        if ($process) { $pending.Enqueue($process) }
    }
    $snapshot = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    while ($pending.Count -gt 0) {
        $parent = $pending.Dequeue()
        if ($owned.ContainsKey($parent.Id)) { continue }
        $owned[$parent.Id] = @{ Id = $parent.Id; StartTicks = $parent.StartTime.ToUniversalTime().Ticks.ToString() }
        foreach ($child in @($snapshot | Where-Object { $_.ParentProcessId -eq $parent.Id })) {
            $live = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
            # CIM timestamps have microsecond precision; Get-Process preserves
            # Windows' 100ns timestamp. Compare within that rounding interval.
            if ($live -and [Math]::Abs($live.StartTime.ToUniversalTime().Ticks - $child.CreationDate.ToUniversalTime().Ticks) -lt 10 -and $live.StartTime -ge $parent.StartTime) {
                $pending.Enqueue($live)
            }
        }
    }
    return @($owned.Values)
}

function Save-OwnedServices {
    $script:ownedProcesses = @(Get-OwnedTree $script:ownedProcesses)
    $temporary = "$stateFile.$PID.tmp"
    ConvertTo-Json -InputObject @($script:ownedProcesses) | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $stateFile -Force
}

function Stop-OwnedServices($Records) {
    $targets = @(Get-OwnedTree $Records)
    foreach ($record in $targets) {
        $process = Get-OwnedProcess $record
        if ($process) {
            $kill = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\taskkill.exe') -ArgumentList @('/PID', $process.Id, '/T', '/F') -WindowStyle Hidden -Wait -PassThru
            if ($kill.ExitCode -ne 0 -and (Get-OwnedProcess $record)) { throw "Tidak dapat menghentikan proses runner $($process.Id)." }
        }
    }
    foreach ($record in $targets) {
        if (Get-OwnedProcess $record) { throw "Proses runner $($record.Id) masih aktif. Coba stop kembali." }
    }
}

function Quote-Literal([string] $Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

function Open-Service([string] $Title, [string] $Directory, [string] $Command) {
    $script = "`$Host.UI.RawUI.WindowTitle = $(Quote-Literal $Title); Set-Location -LiteralPath $(Quote-Literal $Directory); $Command"
    if ($Background) {
        $log = Join-Path $stateDirectory ($Title.Replace(' ', '-').ToLowerInvariant() + '.log')
        $script = "Set-Location -LiteralPath $(Quote-Literal $Directory); & { $Command } *> $(Quote-Literal $log)"
    }
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    if ($Background) {
        $process = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoLogo', '-NoProfile', '-EncodedCommand', $encoded) -PassThru
    } else {
        $process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', $encoded) -PassThru
    }
    $script:ownedProcesses += @{ Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString() }
    Save-OwnedServices
}

function Test-HttpReady([string] $Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

try {
    if ($Stop) {
        if (Test-Path -LiteralPath $stateFile) {
            Stop-OwnedServices @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)
            Remove-Item -LiteralPath $stateFile
            if ($Background) { (New-Object -ComObject WScript.Shell).Popup('Layanan Visitor Counter sudah dihentikan. Tab browser boleh ditutup.', 5, 'Visitor Counter', 64) | Out-Null }
        } else {
            throw 'Daftar proses runner tidak ditemukan. Jalankan aplikasi dari run-windows.cmd atau run-windows.vbs versi terbaru di folder project yang sama. Proses versi lama perlu dihentikan manual satu kali.'
        }
        exit 0
    }
    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    if (Test-Path -LiteralPath $stateFile) {
        foreach ($record in @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)) {
            $existing = Get-OwnedProcess $record
            if ($existing) {
                throw 'Runner masih aktif. Gunakan stop-windows.vbs sebelum menjalankan ulang.'
            }
        }
    }
    $frontend = Split-Path -Parent $PSScriptRoot
    $backend = if ($env:DESKTOP_BACKEND_ROOT) { $env:DESKTOP_BACKEND_ROOT } else { Join-Path (Split-Path -Parent $frontend) 'recognize_cctv' }
    $backend = (Resolve-Path -LiteralPath $backend).Path
    $python = if ($env:DESKTOP_PYTHON) { $env:DESKTOP_PYTHON } else { Join-Path $backend 'desktop\.venv\Scripts\python.exe' }
    if (-not (Test-Path -LiteralPath (Join-Path $backend 'main.py'))) { throw 'Backend main.py tidak ditemukan.' }
    if (-not (Test-Path -LiteralPath $python)) {
        throw 'Python backend belum siap. Dari folder frontend jalankan: uv sync --project ..\recognize_cctv\desktop --locked --python 3.12'
    }
    $python = (Resolve-Path -LiteralPath $python).Path
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $next = Join-Path $frontend 'node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $next)) { throw 'Dependency frontend belum siap. Jalankan: npm ci --include=dev' }
    if (-not (Test-Path -LiteralPath (Join-Path $backend '.env'))) {
        throw 'Siapkan file .env backend dari .env.example dan konfigurasi database/autentikasinya terlebih dahulu.'
    }
    foreach ($port in @(8000, 3000)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
            throw "Port $port sedang dipakai. Tutup server sebelumnya sebelum menjalankan runner lagi."
        }
    }
    $probe = & $python -c 'import uvicorn' 2>&1
    if ($LASTEXITCODE -ne 0) { throw 'Uvicorn belum tersedia pada Python backend. Jalankan uv sync --project ..\recognize_cctv\desktop --locked.' }
    Open-Service 'Visitor Counter - Backend' $backend "& $(Quote-Literal $python) -m uvicorn main:app --host 127.0.0.1 --port 8000; Write-Host 'Backend berhenti. Periksa pesan di atas.'"
    Open-Service 'Visitor Counter - Frontend' $frontend "`$env:NEXT_PUBLIC_SERVICE_RECOGNIZE_CCTV = 'http://127.0.0.1:8000'; & $(Quote-Literal $node) $(Quote-Literal $next) dev --hostname 127.0.0.1 --port 3000; Write-Host 'Frontend berhenti. Periksa pesan di atas.'"
    Write-Host 'Untuk berhenti: tekan Ctrl+C pada KEDUA terminal. Runner ini untuk development web, bukan installer desktop.'
    Write-Host 'Menunggu backend dan frontend siap sebelum membuka browser (maksimal sekitar 3 menit)...'
    $deadline = [DateTime]::UtcNow.AddMinutes(3)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        Save-OwnedServices
        if ((Test-HttpReady 'http://127.0.0.1:8000/') -and (Test-HttpReady 'http://127.0.0.1:3000/')) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    Save-OwnedServices
    if (-not $ready) {
        throw 'Server belum siap dalam 3 menit. Periksa error di terminal backend/frontend. Setelah diperbaiki, buka http://127.0.0.1:3000 secara manual. Kedua terminal tetap terbuka.'
    }
    Start-Process 'http://127.0.0.1:3000'
    Write-Host 'Aplikasi dibuka pada browser default: http://127.0.0.1:3000'
} catch {
    $message = "Runner gagal: " + $_.Exception.Message
    if ($Background) {
        try { Stop-OwnedServices $script:ownedProcesses } catch { $message += "`n" + $_.Exception.Message }
        $message += "`nLog: $stateDirectory"
        (New-Object -ComObject WScript.Shell).Popup($message, 0, 'Visitor Counter', 16) | Out-Null
    } else { Write-Host $message -ForegroundColor Red }
    exit 1
}
