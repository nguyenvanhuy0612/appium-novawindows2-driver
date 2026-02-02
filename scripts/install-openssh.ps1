# Ensure the script is run as Administrator
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Please run as administrator"
    Pause
    exit 1
}

$DownloadUrl = "https://github.com/PowerShell/Win32-OpenSSH/releases/download/10.0.0.0p2-Preview/OpenSSH-Win64.zip"
$CurrentDir = Get-Location
$ZipPath = Join-Path -Path $CurrentDir -ChildPath "OpenSSH-Win64.zip"
$ExtractedPath = Join-Path -Path $CurrentDir -ChildPath "OpenSSH-Win64"
$InstallDir = "C:\OpenSSH-Win64"

# Download OpenSSH if not present
if (-not (Test-Path -Path $ZipPath)) {
    Write-Host "Downloading OpenSSH..."
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
}

# Extract OpenSSH
if (-not (Test-Path -Path $ExtractedPath)) {
    Write-Host "Extracting OpenSSH..."
    Expand-Archive -Path $ZipPath -DestinationPath $CurrentDir -Force
}

# Install (Copy) OpenSSH to C:\
if (-not (Test-Path -Path $InstallDir)) {
    Write-Host "Copying OpenSSH to $InstallDir..."
    Copy-Item -Path $ExtractedPath -Destination "C:\" -Recurse -Force
}

# Grant permissions
Start-Process -FilePath "icacls.exe" -ArgumentList "`"$InstallDir\libcrypto.dll`" /grant Everyone:RX" -NoNewWindow -Wait

# Run the installer script
Set-Location -Path $InstallDir
Write-Host "Running install-sshd.ps1..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-ExecutionPolicy Bypass .\install-sshd.ps1" -NoNewWindow -Wait

# Configure and Start Services using PowerShell Cmdlets
Write-Host "Configuring Services..."
Set-Service -Name sshd -StartupType Automatic
Set-Service -Name ssh-agent -StartupType Automatic
Start-Service -Name ssh-agent
Start-Service -Name sshd

# Firewall Rule
if (-not (Get-NetFirewallRule -Name sshd -ErrorAction SilentlyContinue)) {
    Write-Host "Creating Firewall Rule..."
    New-NetFirewallRule -Name sshd -DisplayName "OpenSSH SSH Server" `
        -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 `
        -Program "$InstallDir\sshd.exe"
}

Write-Host "OpenSSH installation completed."
