$ip = "192.168.1.19"
$user = "admin"
$pass = "welcome"
# SSH to Window and Start_Appium.ps1
Write-Host "Starting Appium..." -ForegroundColor Cyan
ssh -l $user $ip "powershell -ExecutionPolicy Bypass -File C:\Share\appium-novawindows2-driver\scripts\Start_Appium.ps1"