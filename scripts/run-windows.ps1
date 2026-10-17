param([switch] $Background, [switch] $Stop)
$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$hash = [Security.Cryptography.SHA256]::Create()
try { $projectKey = ([BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($frontendRoot.ToLowerInvariant())))).Replace('-', '').Substring(0, 16) } finally { $hash.Dispose() }
$stateDirectory = Join-Path $env:LOCALAPPDATA "VisitorCounterRunner\$projectKey"
$stateFile = Join-Path $stateDirectory 'processes.json'
$script:ownedProcesses = @()

function Stop-OwnedServices($Records) {
    foreach ($record in $Records) {
        $process = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.StartTicks) {
            & taskkill.exe /PID $process.Id /T /F | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Tidak dapat menghentikan proses runner $($process.Id)." }
        }
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
        $script:ownedProcesses += @{ Id = $process.Id; StartTicks = $process.StartTime.ToUniversalTime().Ticks.ToString() }
        ConvertTo-Json -InputObject @($script:ownedProcesses) | Set-Content -LiteralPath $stateFile -Encoding UTF8
    } else {
        Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', $encoded) | Out-Null
    }
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
        }
        exit 0
    }
    if ($Background) {
        New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
        if (Test-Path -LiteralPath $stateFile) {
            foreach ($record in @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)) {
                $existing = Get-Process -Id $record.Id -ErrorAction SilentlyContinue
                if ($existing -and $existing.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.StartTicks) {
                    throw 'Runner masih aktif. Gunakan stop-windows.vbs sebelum menjalankan ulang.'
                }
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
    Write-Host 'Untuk berhenti: tekan Ctrl+C pada KEDUA terminal. Runner ini untuk development web, bukan installer Electron.'
    Write-Host 'Menunggu backend dan frontend siap sebelum membuka browser (maksimal sekitar 3 menit)...'
    $deadline = [DateTime]::UtcNow.AddMinutes(3)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        if ((Test-HttpReady 'http://127.0.0.1:8000/') -and (Test-HttpReady 'http://127.0.0.1:3000/')) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    }
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
