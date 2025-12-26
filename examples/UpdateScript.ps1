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

# 2. Run Robocopy without the /ZB flag to avoid the privilege error
# We use /E /IS to force overwrite without deleting extra files, OR /MIR to exact mirror.
Write-Host "Syncing files and overwriting destination..." -ForegroundColor Cyan
robocopy $source $destination /E /IS /XD node_modules .git /R:5 /W:5 /MT:8

Write-Host "Done!" -ForegroundColor Green