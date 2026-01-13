$u = "admin"
$title = "AppiumServer"
taskkill /f /fi "windowtitle eq $title" /t 2>$null
taskkill /f /im node.exe /t 2>$null
Get-Process -Name powershell, pwsh -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force
$c = "`$host.UI.RawUI.WindowTitle = '$title'; appium --relaxed-security"
$a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoExit -Command ""$c"""
$p = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "AppiumVisible" -Action $a -Principal $p -Force
Start-ScheduledTask -TaskName "AppiumVisible"
Start-Sleep 10
Unregister-ScheduledTask -TaskName "AppiumVisible" -Confirm:$false
