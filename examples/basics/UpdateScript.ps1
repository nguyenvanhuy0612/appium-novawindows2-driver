$driveLetter = "N"
$networkPath = "\\192.168.196.155\C_Share"
$user = "admin"
$pass = "welcome"
$source = "D:\SecureAge\appium-novawindows2-driver"
$destination = "$($driveLetter):\appium-novawindows2-driver"

# 1. Connect drive if not present
if (!(Get-PSDrive -Name $driveLetter -ErrorAction SilentlyContinue)) {
    $secPassword = ConvertTo-SecureString $pass -AsPlainText -Force
    $creds = New-Object System.Management.Automation.PSCredential ($user, $secPassword)
    New-PSDrive -Name $driveLetter -PSProvider FileSystem -Root $networkPath -Credential $creds -Persist -Scope Global
}

# 2. Build
Write-Host "Building..." -ForegroundColor Cyan
Set-Location $source
npm run build

# 3. Run Robocopy without the /ZB flag to avoid the privilege error
# We use /E /IS to force overwrite without deleting extra files, OR /MIR to exact mirror.
Write-Host "Syncing files and overwriting destination..." -ForegroundColor Cyan
robocopy $source $destination /E /IS /XD node_modules .git /R:5 /W:5 /MT:8

# 5. Remote Restart Appium via SSH
Write-Host "Restarting Remote Appium..." -ForegroundColor Cyan

# Use SSH (Password input required unless keys are set up)
# Note: We must use the 'C:\' path because 'N:\' (Mapped Drive) is not visible in the SSH session.
$remoteScriptPath = "C:\Share\appium-novawindows2-driver\examples\basics\Start_Appium_TS.ps1"

Write-Host "NOTE: SSH Automation enabled via authorized_keys." -ForegroundColor Green
ssh admin@192.168.196.155 "powershell -ExecutionPolicy Bypass -File $remoteScriptPath"

Write-Host "Done! Appium should be restarting." -ForegroundColor Green