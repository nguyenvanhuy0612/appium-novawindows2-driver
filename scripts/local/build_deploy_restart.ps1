<#
.SYNOPSIS
    Build, package, deploy, and restart Appium NovaWindows2 driver on a remote Windows host.

.DESCRIPTION
    Default flow (no flags):
      1. npm install + npm run build (local)
      2. Zip lib/build/scripts/*.json
      3. SCP zip to remote
      4. Stop running Appium on remote
      5. Extract zip (preserving node_modules)
      6. npm install --omit=dev on remote (so @appium/base-driver etc. are present)
      7. appium driver install --source=local
      8. Restart Appium as an interactive Scheduled Task

    Flags allow partial flows:
      -SkipBuild     : skip step 1 (reuse existing local build/)
      -SkipInstall   : skip step 6 (reuse existing remote node_modules)
      -NoRestart     : do steps 1-7 but leave Appium alone (8 skipped)
      -RestartOnly   : skip 1-7, just restart remote Appium

.PARAMETER RemoteHost
    Target Windows host. Defaults to $env:TARGET_IP or 192.168.196.128.

.PARAMETER RemoteUser
    SSH user on the target. Defaults to $env:TARGET_USER or 'admin'.

.PARAMETER Port
    SSH port. Default 22.

.NOTES
    Requires: npm, scp, ssh, PowerShell 5.1+. Remote host must run OpenSSH Server
    with key-based auth for $RemoteUser.
#>

param(
    [string]$RemoteHost  = $(if ($env:TARGET_IP)   { $env:TARGET_IP }   else { '192.168.196.128' }),
    [string]$RemoteUser  = $(if ($env:TARGET_USER) { $env:TARGET_USER } else { 'admin' }),
    [int]   $Port        = 22,
    [switch]$SkipBuild,
    [switch]$SkipInstall,
    [switch]$NoRestart,
    [switch]$RestartOnly
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
function Write-Step($n, $total, $msg) { Write-Host "[$n/$total] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)                { Write-Host "  [OK]   $msg"   -ForegroundColor Green }
function Write-Skip($msg)              { Write-Host "  [SKIP] $msg"   -ForegroundColor DarkGray }
function Stop-WithError($msg)          { Write-Host "  [ERR]  $msg"   -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------------------
# Remote-execution helpers
# ---------------------------------------------------------------------------
$script:SshArgs = @('-p', $Port, "$RemoteUser@$RemoteHost")

# Run a PowerShell script block on the remote host. Encodes as base64 so we
# don't have to think about quoting. Returns stdout (printed indented). Throws
# on non-zero exit.
#
# Key plumbing:
#  - Remote scripts must use Write-Output, NOT Write-Host. Write-Host sends
#    messages via the host channel, which over PS-over-ssh becomes CLIXML on
#    stderr and ALSO renders directly in the local PS host -> duplicate output.
#  - $ProgressPreference is silenced remotely so progress records don't
#    pollute stderr with CLIXML.
#  - ssh stderr is dropped (2>$null). PowerShell otherwise tries to parse it
#    as CLIXML and emits "Cannot process the XML..." warnings on every line.
#  - Local $ErrorActionPreference is temporarily relaxed so PS does not throw
#    on ssh.exe's non-empty stderr; we still detect failure via $LASTEXITCODE.
function Invoke-RemotePs {
    param(
        [Parameter(Mandatory)] [string] $Script,
        [string] $StepLabel = 'remote command'
    )
    $prefix = "`$ProgressPreference = 'SilentlyContinue'`n`$ErrorActionPreference = 'Stop'`n"
    $bytes  = [System.Text.Encoding]::Unicode.GetBytes($prefix + $Script)
    $encoded = [Convert]::ToBase64String($bytes)

    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & ssh @script:SshArgs "powershell -NoProfile -NonInteractive -EncodedCommand $encoded" 2>$null
        $exit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEAP
    }

    if ($exit -ne 0) {
        if ($output) { $output | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow } }
        Stop-WithError "$StepLabel failed (ssh exit $exit)"
    }
    if ($output) {
        $output | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    }
}

function Invoke-RemoteScp {
    param(
        [Parameter(Mandatory)] [string] $LocalPath,
        [Parameter(Mandatory)] [string] $RemotePath
    )
    & scp -P $Port $LocalPath "${RemoteUser}@${RemoteHost}:$RemotePath" 2>&1 |
        ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
    if ($LASTEXITCODE -ne 0) { Stop-WithError "SCP transfer failed (exit $LASTEXITCODE)" }
}

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
$source        = (Resolve-Path "$PSScriptRoot\..\..").Path -replace '\\', '/'
$logDir        = "$source/log"
$zipPath       = "$logDir/deploy_novawindows.zip"
$remoteRoot    = 'C:/appium'
$remoteDest    = "$remoteRoot/appium-novawindows2-driver"
$remoteZipPath = "$remoteRoot/deploy_novawindows.zip"
$includeItems  = @('build', 'lib', 'scripts', '*.json')

# ---------------------------------------------------------------------------
# Plan + total step count for the chosen flow
# ---------------------------------------------------------------------------
$plan = [ordered]@{
    Build      = -not $SkipBuild   -and -not $RestartOnly
    Package    = -not $RestartOnly
    Transfer   = -not $RestartOnly
    StopAppium = -not $RestartOnly  # restart path stops Appium itself
    Extract    = -not $RestartOnly
    NpmInstall = -not $SkipInstall  -and -not $RestartOnly
    Register   = -not $RestartOnly
    Restart    = -not $NoRestart
}
$total = ($plan.Values | Where-Object { $_ }).Count
$step  = 0

Write-Host ""
Write-Host "Deploy target: $RemoteUser@${RemoteHost}:$Port" -ForegroundColor White
Write-Host "Local source:  $source"
Write-Host "Remote dest:   $remoteDest"
Write-Host ""

# ---------------------------------------------------------------------------
# 1. Build (local)
# ---------------------------------------------------------------------------
if ($plan.Build) {
    Write-Step (++$step) $total 'Building project...'
    Set-Location $source
    & npm install
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'npm install failed' }
    & npm run build
    if ($LASTEXITCODE -ne 0) { Stop-WithError 'npm run build failed' }
    Write-Ok 'Build complete'
} elseif (-not $RestartOnly) {
    Write-Skip 'Build (--SkipBuild)'
}

# ---------------------------------------------------------------------------
# 2. Package
# ---------------------------------------------------------------------------
if ($plan.Package) {
    Write-Step (++$step) $total 'Creating deployment package...'
    if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null }
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    $itemsToZip = foreach ($item in $includeItems) {
        $path = Join-Path $source $item
        if (Test-Path $path) { Get-Item $path }
        else { Write-Host "    [WARN] skipping missing: $path" -ForegroundColor Yellow }
    }
    if (-not $itemsToZip) { Stop-WithError 'No items found to package' }

    Compress-Archive -Path $itemsToZip.FullName -DestinationPath $zipPath -CompressionLevel Fastest -Force
    $sizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Ok "Package created ($sizeMB MB)"
}

# ---------------------------------------------------------------------------
# 3. Transfer
# ---------------------------------------------------------------------------
if ($plan.Transfer) {
    Write-Step (++$step) $total 'Transferring package...'
    Invoke-RemotePs -StepLabel 'create remote dir' -Script @"
if (-not (Test-Path '$remoteRoot')) { New-Item -Path '$remoteRoot' -ItemType Directory -Force | Out-Null }
"@
    Invoke-RemoteScp -LocalPath $zipPath -RemotePath $remoteZipPath
    Write-Ok 'Transfer complete'
}

# ---------------------------------------------------------------------------
# 4. Stop existing Appium
# ---------------------------------------------------------------------------
if ($plan.StopAppium) {
    Write-Step (++$step) $total 'Stopping existing Appium server...'
    Invoke-RemotePs -StepLabel 'stop Appium' -Script @'
$title = 'AppiumServer'
taskkill /f /fi "windowtitle eq $title" /t 2>$null | Out-Null
taskkill /f /im node.exe /t                  2>$null | Out-Null
Get-Process -Name powershell, pwsh -ErrorAction SilentlyContinue |
    Where-Object { $_.Id -ne $PID } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Write-Output 'appium processes stopped'
'@
    Write-Ok 'Appium stopped'
}

# ---------------------------------------------------------------------------
# 5. Extract (preserving node_modules)
# ---------------------------------------------------------------------------
if ($plan.Extract) {
    Write-Step (++$step) $total 'Extracting package...'
    Invoke-RemotePs -StepLabel 'extract' -Script @"
`$dest = '$remoteDest'
`$zip  = '$remoteZipPath'
if (Test-Path `$dest) {
    Write-Output '  -> destination exists; cleaning (preserving node_modules)'
    Get-ChildItem -Path `$dest -Exclude 'node_modules' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Output '  -> creating destination'
    New-Item -Path `$dest -ItemType Directory -Force | Out-Null
}
Write-Output '  -> expanding archive'
Expand-Archive -Path `$zip -DestinationPath `$dest -Force
"@
    Write-Ok 'Package extracted'
}

# ---------------------------------------------------------------------------
# 6. Install runtime deps on remote
# ---------------------------------------------------------------------------
if ($plan.NpmInstall) {
    Write-Step (++$step) $total 'Installing runtime dependencies on remote...'
    Invoke-RemotePs -StepLabel 'npm install --omit=dev' -Script @"
`$env:PATH += ';' + `$env:APPDATA + '\npm;' + `$env:ProgramFiles + '\nodejs'
Set-Location '$remoteDest'
`$hasBaseDriver = Test-Path 'node_modules\@appium\base-driver'
if (`$hasBaseDriver) { Write-Output '  -> base-driver already present; running npm install to sync' }
else                 { Write-Output '  -> first install on this host (this can take 1-2 min)' }
npm install --omit=dev --no-audit --no-fund --silent 2>&1 | Select-Object -Last 5
if (`$LASTEXITCODE -ne 0) { throw 'npm install failed' }
Write-Output '  -> dependencies installed'
"@
    Write-Ok 'Dependencies installed'
} elseif (-not $RestartOnly) {
    Write-Skip 'npm install (--SkipInstall)'
}

# ---------------------------------------------------------------------------
# 7. Register driver with Appium
# ---------------------------------------------------------------------------
if ($plan.Register) {
    Write-Step (++$step) $total 'Registering driver with Appium...'
    Invoke-RemotePs -StepLabel 'register driver' -Script @"
`$ErrorActionPreference = 'Continue'
`$env:PATH += ';' + `$env:APPDATA + '\npm;' + `$env:ProgramFiles + '\nodejs'

Write-Output '  -> uninstalling previous novawindows2 driver'
& appium driver uninstall novawindows2 2>&1 | Out-Null

`$p = `"`$env:USERPROFILE\.appium\node_modules`"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue `"`$p\appium-novawindows2-driver`", `"`$p\.cache`", `"`$p\.package-lock.json`"
npm cache clean --force 2>&1 | Out-Null

Write-Output '  -> installing novawindows2 driver from local source'
& appium driver install --source=local '$remoteDest' 2>&1

Write-Output '  -> installed drivers:'
& appium driver list --installed 2>&1
"@
    Write-Ok 'Driver registered'
}

# ---------------------------------------------------------------------------
# 8. Restart Appium (interactive Scheduled Task → Session 1, not Session 0)
# ---------------------------------------------------------------------------
if ($plan.Restart) {
    Write-Step (++$step) $total 'Starting Appium...'
    if ($RestartOnly) {
        # Stop first since we skipped step 4
        Invoke-RemotePs -StepLabel 'stop Appium (restart-only)' -Script @'
taskkill /f /fi "windowtitle eq AppiumServer" /t 2>$null | Out-Null
taskkill /f /im node.exe /t                   2>$null | Out-Null
'@
    }
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
    Write-Ok 'Appium started'
} else {
    Write-Skip 'Restart (--NoRestart)'
}

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "  Appium URL: http://${RemoteHost}:4723/" -ForegroundColor White
Write-Host "  Tail log:   .\scripts\local\copy_log.ps1 -RemoteHost $RemoteHost -Tail 50" -ForegroundColor White
