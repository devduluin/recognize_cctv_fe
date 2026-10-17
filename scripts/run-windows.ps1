$ErrorActionPreference = 'Stop'

function Quote-Literal([string] $Value) {
    return "'" + $Value.Replace("'", "''") + "'"
}

function Open-Service([string] $Title, [string] $Directory, [string] $Command) {
    $script = "`$Host.UI.RawUI.WindowTitle = $(Quote-Literal $Title); Set-Location -LiteralPath $(Quote-Literal $Directory); $Command"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($script))
    Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoLogo', '-NoProfile', '-NoExit', '-EncodedCommand', $encoded) | Out-Null
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
    Write-Host ("Runner gagal: " + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
