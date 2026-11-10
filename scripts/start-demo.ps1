# Run from PowerShell: powershell -ExecutionPolicy Bypass -File scripts/start-demo.ps1
# Keeps existing services; starts only missing project listeners.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nodeExe = (Get-Command node).Source
$logDirectory = Join-Path $projectRoot 'tmp'
New-Item -ItemType Directory -Force $logDirectory | Out-Null
function Listening($port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}
if (!(Listening 6379)) {
    Start-Process -FilePath "$env:WINDIR/System32/wsl.exe" -ArgumentList '-e sleep 86400' -WindowStyle Hidden
    & "$env:WINDIR/System32/wsl.exe" -e sh -lc 'redis-cli ping'
    if ($LASTEXITCODE -ne 0) { throw 'Start Redis in WSL (sudo service redis-server start), then retry.' }
}
foreach ($service in @(
    @{ Name='backend'; Port=5000; Folder='backend'; Args='src/app.js' },
    @{ Name='frontend'; Port=3000; Folder='frontend'; Args='node_modules/next/dist/bin/next start --port 3000' }
)) {
    if (!(Listening $service.Port)) {
        Start-Process -FilePath $nodeExe -ArgumentList $service.Args -WorkingDirectory (Join-Path $projectRoot $service.Folder) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory "$($service.Name).log") -RedirectStandardError (Join-Path $logDirectory "$($service.Name)-error.log")
    }
}
Write-Host 'Demo servers starting: http://localhost:3000. Logs are in tmp/.'
Write-Host 'Run node simulator/wearableSimulator.js in a separate terminal to generate readings.'
Write-Host 'Check http://localhost:5000/api/health before presenting.'
