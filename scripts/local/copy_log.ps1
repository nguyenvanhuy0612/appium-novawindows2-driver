## Copy log from remote machine to local machine

$ip = "192.168.1.19"
$user = "admin"
$password = "welcome"

# Copy log from remote machine to local machine
$remotePath = "C:/Users/$user/Desktop/appium_server.log"
$localPath = "D:/SecureAge/appium-novawindows2-driver"

if (-not (Test-Path $localPath)) {
    Write-Host "Local path $localPath does not exist." -ForegroundColor Red
    exit 1
}

scp "$user@${ip}:$remotePath" "$localPath"