
Add-Type -AssemblyName UIAutomationClient
Write-Output "Name | ClassName"
Write-Output "----------------"
[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object {
    try {
        Write-Output "$($_.Current.Name) | $($_.Current.ClassName)"
    }
    catch {}
}
