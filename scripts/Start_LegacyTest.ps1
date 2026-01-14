# Helper script to run legacy_test.ps1 in the interactive session via Task Scheduler

$u = (Get-Process explorer -IncludeUserName | Select-Object -First 1).UserName.Split('\')[-1]
$taskName = "LegacyTestRunner"
$logPath = "C:\Users\$u\legacy_test.log"
$scriptPath = "C:\Users\$u\legacy_test.ps1"

Write-Output "Preparing to run $scriptPath as user $u via Task Scheduler..."

# Clean up previous log
if (Test-Path $logPath) { Remove-Item $logPath -Force }

# Clean up previous task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Define Action: Run PowerShell script and redirect output
# Note: redirection in Scheduled Task action arguments can be tricky. 
# We wrap the command in another powershell call.
$command = "powershell.exe -ExecutionPolicy Bypass -File $scriptPath > $logPath 2>&1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-Command ""$command"""

# Define Principal: Interactive User, Highest Privileges
$principal = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Highest

# Register Task
Register-ScheduledTask -TaskName $taskName -Action $action -Principal $principal -Force

# Start Task
Write-Output "Starting task..."
Start-ScheduledTask -TaskName $taskName

# Wait for task to complete (simple poll)
Write-Output "Waiting for detailed log..."
$timeout = 60
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $timeout) {
    $state = (Get-ScheduledTask -TaskName $taskName).State
    if ($state -eq 'Ready' -or $state -eq 'Disabled') {
        # Task finished (State goes back to Ready)
        break
    }
    Start-Sleep -Seconds 1
}

Write-Output "Task execution finished (or timed out)."

# Clean up Task
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
