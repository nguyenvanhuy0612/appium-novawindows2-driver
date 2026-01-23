$driveLetter = "N"
$ip = "192.168.1.19"
$networkPath = "\\$ip\C_Share"
$user = "admin"
$pass = "welcome"
$source = "D:\SecureAge\appium-novawindows2-driver"
$destination = "$($driveLetter):\appium-novawindows2-driver"

# 1. Clear existing connections to avoid "remembered connection" errors
if (Get-PSDrive -Name $driveLetter -ErrorAction SilentlyContinue) {
    Remove-PSDrive -Name $driveLetter -Force -ErrorAction SilentlyContinue
}
# Force delete any lingering OS-level mappings
cmd /c "net use $driveLetter`: /delete /y" | Out-Null

$secPassword = ConvertTo-SecureString $pass -AsPlainText -Force
$creds = New-Object System.Management.Automation.PSCredential ($user, $secPassword)
New-PSDrive -Name $driveLetter -PSProvider FileSystem -Root $networkPath -Credential $creds -Persist

# 2. Build
Write-Host "Building..." -ForegroundColor Cyan
Set-Location $source
npm run build

# 3. Run Robocopy without the /ZB flag to avoid the privilege error
# We use /E /IS to force overwrite without deleting extra files, OR /MIR to exact mirror.
Write-Host "Syncing files and overwriting destination..." -ForegroundColor Cyan
# robocopy $source $destination /E /IS /XD node_modules .git .agent .github .vscode /R:5 /W:5 /MT:8
# robocopy $source $destination *.json /IS /R:5 /W:5 /MT:8
# robocopy $source $destination build lib scripts package.json /E /IS /R:5 /W:5 /MT:8
robocopy $source $destination /MIR /XD node_modules .git .agent .github .vscode /R:5 /W:5 /MT:8
