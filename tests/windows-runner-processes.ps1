$ErrorActionPreference = 'Stop'
$runner = Join-Path $PSScriptRoot '..\scripts\run-windows.ps1'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($runner, [ref] $tokens, [ref] $errors)
if ($errors.Count) { throw ($errors | Out-String) }
# Load helpers without executing the real launcher or touching application data.
foreach ($definition in $ast.FindAll({ param($item) $item -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
    . ([scriptblock]::Create($definition.Extent.Text))
}
$stateDirectory = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $stateDirectory | Out-Null
$stateFile = Join-Path $stateDirectory 'processes.json'
$cleanup = @()
try {
    # A reused PID must not select even this test process for termination.
    Stop-OwnedServices @(@{ Id = $PID; StartTicks = '0' })
    foreach ($mode in @($false, $true)) {
        $Background = $mode
        $script:ownedProcesses = @()
        Open-Service 'Runner Test' $stateDirectory "& powershell.exe -NoProfile -Command 'Start-Sleep -Seconds 60'"
        $cleanup += $script:ownedProcesses
        $deadline = [DateTime]::UtcNow.AddSeconds(15)
        do {
            Start-Sleep -Milliseconds 200
            Save-OwnedServices
        } while ($script:ownedProcesses.Count -lt 2 -and [DateTime]::UtcNow -lt $deadline)
        $records = @(Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json)
        $cleanup += $records
        if ($records.Count -lt 2) { throw "Child process was not recorded (background=$mode)." }
        if ($mode) {
            # Simulate a shell that died and left its child alive.
            $root = $records | Where-Object {
                (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").ParentProcessId -eq $PID
            } | Select-Object -First 1
            if (-not $root) { throw 'Runner root was not recorded.' }
            $rootProcess = Get-OwnedProcess $root
            Stop-Process -Id $root.Id -Force
            if (-not $rootProcess.WaitForExit(5000)) { throw 'Test shell did not exit.' }
            if (@($records | Where-Object { $_.Id -ne $root.Id -and (Get-OwnedProcess $_) }).Count -eq 0) {
                throw 'Orphan process scenario was not exercised.'
            }
        }
        Stop-OwnedServices $records
        foreach ($record in $records) {
            if (Get-OwnedProcess $record) { throw 'Runner left a process alive.' }
        }
    }
    Write-Output 'Windows runner process lifecycle passed.'
} finally {
    foreach ($record in $cleanup) {
        $process = Get-OwnedProcess $record
        if ($process) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item -LiteralPath $stateDirectory -Recurse -Force
}
