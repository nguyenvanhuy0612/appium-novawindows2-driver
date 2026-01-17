<#
.SYNOPSIS
    Deploys the Appium NovaWindows2 Driver to a remote Windows machine.

.DESCRIPTION
    This script builds the project locally, packages the necessary artifacts into a zip file,
    transfers the package via SCP to a remote machine, and executes a remote deployment sequence.
    The remote sequence includes stopping existing Appium processes, unzipping the new package,
    and restarting the Appium server as an interactive Scheduled Task.
    
.NOTES
    Requires: npm, scp, ssh, and PowerShell 5.1+ or PowerShell Core.
    Remote machine must have OpenSSH Server configured.
#>

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
$ip = "192.168.1.19"
$user = "admin"
$source = "D:/SecureAge/appium-novawindows2-driver"
$remoteDest = "C:/Share/appium-novawindows2-driver"
$zipPath = "$source/log/deploy_novawindows.zip"
$remoteZipPath = "C:/Share/deploy_novawindows.zip"

# Items to include in the deployment package
$includeItems = @("build", "lib", "scripts", "*.json")

# -----------------------------------------------------------------------------
# Step 1: Build Project
# -----------------------------------------------------------------------------
Write-Host "`n[1/6] Building project..." -ForegroundColor Cyan
Set-Location $source
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed! Aborting deployment." -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# Step 2: Create Deployment Package (Zip)
# -----------------------------------------------------------------------------
Write-Host "[2/6] Creating deployment package..." -ForegroundColor Cyan

# Ensure log directory exists locally
$logDir = "$source\log"
if (-not (Test-Path $logDir)) { 
    New-Item -Path $logDir -ItemType Directory -Force | Out-Null 
}

# Remove old zip if exists
if (Test-Path $zipPath) { 
    Remove-Item $zipPath -Force 
}

# Select files to zip (using * wildcard to make -Include work correctly)
# Robust item selection
$itemsToZip = @()
foreach ($item in $includeItems) {
    $path = Join-Path $source $item
    if (Test-Path $path) {
        $itemsToZip += Get-Item $path
    }
    else {
        Write-Host "Warning: Item not found, skipping: $path" -ForegroundColor Yellow
    }
}

if ($itemsToZip.Count -eq 0) {
    Write-Host "No files found to zip! Check configuration." -ForegroundColor Red
    exit 1
}

try {
    Compress-Archive -Path $itemsToZip.FullName -DestinationPath $zipPath -CompressionLevel Fastest -Force
}
catch {
    Write-Host "Failed to create zip archive: $_" -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# Step 3: Transfer Package (SCP)
# -----------------------------------------------------------------------------
Write-Host "[3/6] Transferring package to remote machine..." -ForegroundColor Cyan

# Ensure remote destination directory exists for the zip
$createDirScript = "if (-not (Test-Path 'C:\Share')) {New-Item -Path 'C:\Share' -ItemType Directory -Force | Out-Null }"
ssh $user@$ip "powershell -Command `"$createDirScript`""

# Copy zip to remote
scp "$zipPath" "$user@${ip}:$remoteZipPath"

if ($LASTEXITCODE -ne 0) {
    Write-Host "SCP transfer failed! Aborting." -ForegroundColor Red
    exit 1
}

# -----------------------------------------------------------------------------
# Step 4: Stop Existing Appium Server
# -----------------------------------------------------------------------------
Write-Host "[4/6] Stopping existing Appium server..." -ForegroundColor Cyan

# We use a Here-String for the stop script to ensure consistent execution behavior
# (ScriptBlock.ToString() can vary between PS versions regarding braces)
$stopScript = @"
    Write-Host "  -> identifying and killing active Appium processes..."
    
    # Identify active user
    `$u = (Get-Process explorer -IncludeUserName | Select-Object -First 1).UserName.Split('\')[-1]
    `$title = 'AppiumServer'
    
    # Kill by Window Title first
    taskkill /f /fi "windowtitle eq `$title" /t 2>`$null | Out-Null
    
    # Kill any lingering node processes (fallback)
    taskkill /f /im node.exe /t 2>`$null | Out-Null
    
    # Stop any other user instances if accessible
    Get-Process -Name powershell, pwsh -ErrorAction SilentlyContinue | Where-Object { `$_.Id -ne `$PID } | Stop-Process -Force -ErrorAction SilentlyContinue
"@

$stopBytes = [System.Text.Encoding]::Unicode.GetBytes($stopScript)
$stopEncoded = [Convert]::ToBase64String($stopBytes)

ssh $user@$ip "powershell -EncodedCommand $stopEncoded"

# -----------------------------------------------------------------------------
# Step 5: Extract Package (Preserving node_modules)
# -----------------------------------------------------------------------------
Write-Host "[5/6] Extracting package..." -ForegroundColor Cyan

# We use a Here-String for the extraction script so local variables ($remoteDest, $remoteZipPath) 
# are expanded before sending to the remote machine.
$extractScript = @"
    `$dest = '$remoteDest'
    `$zip = '$remoteZipPath'
    
    if (Test-Path `$dest) {
        Write-Host "  -> Destination exists. Cleaning up (preserving node_modules)..."
        Get-ChildItem -Path `$dest -Exclude 'node_modules' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "  -> Creating destination directory..."
        New-Item -Path `$dest -ItemType Directory -Force | Out-Null
    }

    Write-Host "  -> Expanding archive..."
    Expand-Archive -Path `$zip -DestinationPath `$dest -Force
"@

$extractBytes = [System.Text.Encoding]::Unicode.GetBytes($extractScript)
$extractEncoded = [Convert]::ToBase64String($extractBytes)

ssh $user@$ip "powershell -EncodedCommand $extractEncoded"
# -----------------------------------------------------------------------------
# Step 6: Install Dependencies and Start Appium
# -----------------------------------------------------------------------------
Write-Host "[6/6] Installing dependencies and restarting Appium..." -ForegroundColor Cyan

$startScript = @"
    Set-Location '$remoteDest'
    
    # Install production dependencies only for speed
    #Write-Host '  -> Running npm install...'
    #npm install --no-save | Out-Null
    npm run build | Out-Null

    # Identify the active user for the GUI session (explorer.exe owner)
    `$u = (Get-Process explorer -IncludeUserName | Select-Object -First 1).UserName.Split('\')[-1]
    `$title = 'AppiumServer'
    
    # Construct the start command
    # [Console]::Title is used to ensure the window has a specific title we can target later for stopping.
    `$launchCmd = "[Console]::Title = '`$title'; Set-Location '`$env:USERPROFILE\Desktop'; appium --relaxed-security --log-level debug:debug --log appium_server.log"
    
    # Create valid arguments for 'powershell -NoExit -Command ...'
    # Quotes are concatenated to handle the variable expansion in this Here-String correctly.
    `$actionArg = '-NoExit -Command "' + `$launchCmd + '"'
    
    # Create and Run Scheduled Task
    # This trick allows us to launch a visible interactive window in the user's session from an SSH session
    `$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument `$actionArg
    `$principal = New-ScheduledTaskPrincipal -UserId `$u -LogonType Interactive -RunLevel Highest
    
    Register-ScheduledTask -TaskName 'AppiumVisible' -Action `$action -Principal `$principal -Force | Out-Null
    Start-ScheduledTask -TaskName 'AppiumVisible' | Out-Null
    
    # Wait briefly for task to trigger then cleanup registration
    Start-Sleep 10
    Unregister-ScheduledTask -TaskName 'AppiumVisible' -Confirm:`$false | Out-Null
"@

# Encode for transmission
$startBytes = [System.Text.Encoding]::Unicode.GetBytes($startScript)
$startEncoded = [Convert]::ToBase64String($startBytes)

ssh $user@$ip "powershell -EncodedCommand $startEncoded"

Write-Host "`nDeployment Complete Successfully!" -ForegroundColor Green
