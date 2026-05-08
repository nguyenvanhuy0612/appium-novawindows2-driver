<#
.SYNOPSIS
    Pull the Appium server log from a remote Windows host.

.DESCRIPTION
    Three modes:
      (default)        copy the full log to <repo>/log/appium_server-<host>.log
      -Tail <N>        stream only the last N lines to the console (no local file)
      -Follow          live-tail (Ctrl+C to stop)

.PARAMETER RemoteHost
    Target host. Defaults to $env:TARGET_IP or 192.168.196.128 (matches build_deploy_restart.ps1).

.PARAMETER RemoteUser
    SSH user. Defaults to $env:TARGET_USER or 'admin'.
#>

param(
    [string]$RemoteHost = $(if ($env:TARGET_IP)   { $env:TARGET_IP }   else { '192.168.196.128' }),
    [string]$RemoteUser = $(if ($env:TARGET_USER) { $env:TARGET_USER } else { 'admin' }),
    [int]   $Port       = 22,
    [int]   $Tail       = 0,
    [switch]$Follow
)

$ErrorActionPreference = 'Stop'

$remoteLog = "C:/Users/$RemoteUser/Desktop/appium_server.log"
$repoRoot  = (Resolve-Path "$PSScriptRoot\..\..").Path
$localLog  = Join-Path $repoRoot "log/appium_server-$RemoteHost.log"

if ($Follow) {
    Write-Host "Live-tailing $remoteLog (Ctrl+C to stop)" -ForegroundColor Cyan
    & ssh -p $Port "$RemoteUser@$RemoteHost" "powershell -Command `"Get-Content '$remoteLog' -Wait -Tail 20`""
}
elseif ($Tail -gt 0) {
    Write-Host "Last $Tail lines of $remoteLog" -ForegroundColor Cyan
    & ssh -p $Port "$RemoteUser@$RemoteHost" "powershell -Command `"Get-Content '$remoteLog' -Tail $Tail`""
}
else {
    if (-not (Test-Path (Split-Path $localLog -Parent))) {
        New-Item -Path (Split-Path $localLog -Parent) -ItemType Directory -Force | Out-Null
    }
    Write-Host "Copying $remoteLog -> $localLog" -ForegroundColor Cyan
    & scp -P $Port "${RemoteUser}@${RemoteHost}:$remoteLog" $localLog
    if ($LASTEXITCODE -eq 0) {
        $sizeKB = [Math]::Round((Get-Item $localLog).Length / 1KB, 1)
        Write-Host "  done ($sizeKB KB)" -ForegroundColor Green
    } else {
        Write-Host "  scp failed (exit $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
}
