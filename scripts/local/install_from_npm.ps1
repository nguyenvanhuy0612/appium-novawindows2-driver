#requires -Version 5.1
<#
.SYNOPSIS
  Install appium-novawindows2-driver from npm on a remote VM and restart Appium.
.DESCRIPTION
  Mirrors steps 4 / 7 / 8 of build_deploy_restart.ps1 but pulls the driver from
  the public npm registry instead of a locally-built zip. Use after `npm publish`
  to update remote test hosts to the latest published version.
.PARAMETER RemoteHost
  Target IP. Defaults to env:TARGET_IP or 192.168.196.128.
.PARAMETER Version
  npm version spec, e.g. 'latest', '1.1.19'. Default 'latest'.
#>
[CmdletBinding()]
param(
    [string]$RemoteHost = $(if ($env:TARGET_IP) { $env:TARGET_IP } else { '192.168.196.128' }),
    [string]$RemoteUser = $(if ($env:TARGET_USER) { $env:TARGET_USER } else { 'admin' }),
    [int]$Port = 22,
    [string]$Version = 'latest'
)

$ErrorActionPreference = 'Stop'
$SshArgs = @('-p', $Port, "$RemoteUser@$RemoteHost")

function Invoke-RemotePs {
    param(
        [Parameter(Mandatory)] [string] $Script,
        [string] $StepLabel = 'remote command'
    )
    $prefix = "`$ProgressPreference = 'SilentlyContinue'`n`$ErrorActionPreference = 'Stop'`n"
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($prefix + $Script)
    $encoded = [Convert]::ToBase64String($bytes)

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & ssh @SshArgs "powershell -NoProfile -NonInteractive -EncodedCommand $encoded" 2>$null
        $exit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    if ($exit -ne 0) {
        if ($output) { $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow } }
        throw "$StepLabel failed (ssh exit $exit)"
    }
    if ($output) { $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray } }
}

Write-Host ""
Write-Host "npm install target: $RemoteUser@${RemoteHost}:$Port  (version=$Version)" -ForegroundColor White
Write-Host ""

# 1. Stop Appium
Write-Host "[1/3] Stopping existing Appium server..." -ForegroundColor Cyan
Invoke-RemotePs -StepLabel 'stop Appium' -Script @'
try {
    $title = 'AppiumServer'
    taskkill /f /fi "windowtitle eq $title" /t 2>$null | Out-Null
    taskkill /f /im node.exe /t                  2>$null | Out-Null
    Get-Process -Name powershell, pwsh -ErrorAction SilentlyContinue |
        Where-Object { $_.Id -ne $PID } |
        Stop-Process -Force -ErrorAction SilentlyContinue
} catch { }
Write-Output '  -> appium processes stopped'
exit 0
'@

# 2. Uninstall old, clean caches, install from npm
Write-Host "[2/3] Reinstalling novawindows2 driver from npm ($Version)..." -ForegroundColor Cyan
Invoke-RemotePs -StepLabel 'install driver from npm' -Script @"
`$ErrorActionPreference = 'Continue'
`$env:PATH += ';' + `$env:APPDATA + '\npm;' + `$env:ProgramFiles + '\nodejs'

Write-Output '  -> uninstalling previous novawindows2 driver'
& appium driver uninstall novawindows2 2>&1 | Out-Null

`$p = `"`$env:USERPROFILE\.appium\node_modules`"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue `"`$p\appium-novawindows2-driver`", `"`$p\.cache`", `"`$p\.package-lock.json`"
npm cache clean --force 2>&1 | Out-Null

Write-Output '  -> installing appium-novawindows2-driver@$Version from npm'
& appium driver install --source=npm appium-novawindows2-driver@$Version 2>&1

Write-Output '  -> installed drivers:'
& appium driver list --installed 2>&1
"@

# 3. Restart Appium via Scheduled Task (Session 1 desktop user)
Write-Host "[3/3] Starting Appium..." -ForegroundColor Cyan
Invoke-RemotePs -StepLabel 'start Appium' -Script @'
$u = (Get-Process explorer -IncludeUserName | Select-Object -First 1).UserName.Split('\')[-1]
$title = 'AppiumServer'
$launchCmd = "[Console]::Title = '$title'; Set-Location '$env:USERPROFILE\Desktop'; appium --relaxed-security --log-level debug:debug --log appium_server.log"
$actionArg = '-NoExit -Command "' + $launchCmd + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $actionArg
$principal = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName 'AppiumVisible' -Action $action -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'AppiumVisible' | Out-Null
Start-Sleep 8
Unregister-ScheduledTask -TaskName 'AppiumVisible' -Confirm:$false | Out-Null
Write-Output '  -> scheduled task launched, Appium starting in user session'
'@

Write-Host ""
Write-Host "Install complete." -ForegroundColor Green
Write-Host "  Appium URL: http://${RemoteHost}:4723/" -ForegroundColor White
