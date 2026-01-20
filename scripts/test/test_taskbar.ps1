Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

[System.Windows.Forms.SendKeys]::SendWait("^{ESC}")
Start-Sleep -Seconds 2

Write-Host "Start Menu Should be Open"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}
"@

$hwnd = [User32]::FindWindow("Shell_TrayWnd", $null)
Write-Host "Taskbar Handle: $hwnd"

if ($hwnd -ne [IntPtr]::Zero) {
    try {
        $taskbar = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
        Write-Host "Found Taskbar via Handle: $($taskbar.Current.ClassName)"
        
        # Try to find Start Button under Taskbar
        $startCond = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty, "Start")
        # Or Name "Start" or AccessKey "Ctrl+Esc"
        
        # Note: Search Descendants because there might be intermediate containers (like ReBarWindow32 -> MSTaskSwWClass -> MSTaskListWClass)
        # But Start Button usually is direct child of Shell_TrayWnd or close to it.
        # ClassName "Start" or "Button" with Name "Start"
        
        $startButton = $taskbar.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $startCond)
        
        if ($null -ne $startButton) {
            Write-Host "Found Start Button via Taskbar Handle (by Class 'Start')!"
        }
        else {
            Write-Host "Start Button (Class 'Start') NOT found. Trying Name 'Start'..."
            $startCondName = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, "Start")
            $startButton = $taskbar.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $startCondName)
             
            if ($null -ne $startButton) {
                Write-Host "Found Start Button via Taskbar Handle (by Name 'Start')!"
            }
            else {
                Write-Host "Failed to find Start Button under Taskbar handle"
                # List children for debugging
                # $taskbar.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { Write-Host "Child: $($_.Current.ClassName) - $($_.Current.Name)" }
            }
        }

    }
    catch {
        Write-Host "Failed to get AE from Handle: $_"
    }
}
else {
    Write-Host "Handle not found via Win32"
}

[System.Windows.Forms.SendKeys]::SendWait("^{ESC}")
