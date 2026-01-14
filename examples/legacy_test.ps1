# Simplified LegacyIAccessible Test Script

# 1. Define Minimal MSAA Helper (C#)
# We need this to access the underlying IAccessible COM interface directly,
# which UIA's LegacyIAccessiblePattern sometimes wraps incompletely.
$csharpCode = @'
using System;
using System.Runtime.InteropServices;

public static class SimpleMSAA {
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    public static string GetProperty(IntPtr hwnd, string propName) {
        if (hwnd == IntPtr.Zero) return "Invalid Handle";
        
        Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
        object accObj = null;
        int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);

        if (res == 0 && accObj != null) {
            try {
                // childId = 0 (Self)
                object[] args = new object[] { (int)0 };
                
                string memberName = "";
                switch(propName) {
                    case "Name": memberName = "accName"; break;
                    case "Value": memberName = "accValue"; break;
                    case "Description": memberName = "accDescription"; break;
                    case "Role": memberName = "accRole"; break;
                    case "State": memberName = "accState"; break;
                    case "Help": memberName = "accHelp"; break;
                    case "KeyboardShortcut": memberName = "accKeyboardShortcut"; break;
                    case "DefaultAction": memberName = "accDefaultAction"; break;
                    default: return "Unknown Property";
                }

                object result = accObj.GetType().InvokeMember(memberName, 
                    System.Reflection.BindingFlags.GetProperty, 
                    null, accObj, args);

                return result != null ? result.ToString() : "";
            } catch (Exception e) { 
                return "Error: " + e.Message + " (HResult: " + Marshal.GetHRForException(e).ToString("X") + ")";
            }
        }
        return "Failed to get IAccessible (Res: " + res + ")";
    }
}
'@

try {
    # Remove existing type if possible (not really possible in PS session without restart, 
    # but we are effectively restarting since it runs in a fresh scheduled task every time)
    Add-Type -TypeDefinition $csharpCode -Language CSharp -ErrorAction Stop
}
catch {
    Write-Error "Failed to compile SimpleMSAA: $_"
    Write-Error $_.ScriptStackTrace
}

# 2. Setup UIA
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement

try {
    Write-Output "Root Element Info:"
    Write-Output "  Name: '$($root.Current.Name)'"
    Write-Output "  Class: '$($root.Current.ClassName)'"
    Write-Output "  Handle: $($root.Current.NativeWindowHandle)"
}
catch {
    Write-Error "Failed to access RootElement: $_"
}

# 3. Simple Helper to Find Element
function Find-FirstByName($Name) {
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $Name)
    # Search Scope: Descendants (can be slow, but simple)
    return $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
}

# 4. Main Test Execution
## 4. Helper to Check Element
function Test-Element($target, $label) {
    Write-Output "`n=== TARGET FOUND: $label ==="
    try {
        $name = $target.Current.Name
        $class = $target.Current.ClassName
        $autoId = $target.Current.AutomationId
        $h = $target.Current.NativeWindowHandle

        Write-Output "UIA Name: '$name'"
        Write-Output "UIA Class: '$class'"
        Write-Output "UIA AutoId: '$autoId'"
        Write-Output "Handle: $h"
        
        # Check Legacy Pattern
        Write-Output "`n--- UIA LegacyIAccessiblePattern ---"
        try {
            $legacy = $target.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
            if ($null -ne $legacy) {
                Write-Output "Legacy Pattern Supported"
                Write-Output "Legacy Name: $($legacy.Current.Name)"
                Write-Output "Legacy Value: $($legacy.Current.Value)"
                Write-Output "Legacy Role: $($legacy.Current.Role)"
            }
            else { Write-Output "Legacy Pattern returned null" }
        }
        catch { Write-Output "Legacy Pattern NOT Supported (Exception)" }

        # Check Direct MSAA
        Write-Output "`n--- Direct MSAA (P/Invoke) ---"
        try {
            if ($h -ne 0) {
                if (-not ([System.Management.Automation.PSTypeName]'SimpleMSAA').Type) {
                    Write-Error "SimpleMSAA type is not available."
                }
                else {
                    Write-Output "MSAA Name: $([SimpleMSAA]::GetProperty($h, 'Name'))"
                    Write-Output "MSAA Value: $([SimpleMSAA]::GetProperty($h, 'Value'))"
                    Write-Output "MSAA Description: $([SimpleMSAA]::GetProperty($h, 'Description'))"
                    Write-Output "MSAA Role: $([SimpleMSAA]::GetProperty($h, 'Role'))"
                    Write-Output "MSAA State: $([SimpleMSAA]::GetProperty($h, 'State'))"
                    Write-Output "MSAA Help: $([SimpleMSAA]::GetProperty($h, 'Help'))"
                    Write-Output "MSAA KeyboardShortcut: $([SimpleMSAA]::GetProperty($h, 'KeyboardShortcut'))"
                    Write-Output "MSAA DefaultAction: $([SimpleMSAA]::GetProperty($h, 'DefaultAction'))"
                }
            }
            else { Write-Output "No Window Handle (HWND) - Cannot use MSAA" }
        }
        catch { Write-Error "Direct MSAA Failed: $_" }

        # Check Value Pattern
        Write-Output "`n--- UIA ValuePattern ---"
        try {
            $valPattern = $target.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            if ($null -ne $valPattern) {
                Write-Output "ValuePattern Supported"
                Write-Output "Value.Value: $($valPattern.Current.Value)"
                Write-Output "Value.IsReadOnly: $($valPattern.Current.IsReadOnly)"
            }
            else { Write-Output "ValuePattern NOT Supported" }
        }
        catch { Write-Output "ValuePattern NOT Supported (Exception: $_)" }
        
    }
    catch {
        Write-Error "Failed to process target: $_"
    }
}

# --- TEST CASE 1: Start Button ---
$target = Find-FirstByName "Start"
if ($target) {
    Test-Element $target "Start Button"
}
else {
    Write-Output "Start button not found."
}

# --- TEST CASE 2: ComboBox (Automation Profile) ---
Write-Output "`nSearching for 'Automation Profile22753521' (by Name)..."
$condName = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Automation Profile22753521")
$targetByName = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condName)

if ($targetByName) {
    Test-Element $targetByName "Found by Name 'Automation Profile22753521'"
}
else {
    Write-Output "Not found by generic descendant search. Checking Top-Level Windows..."
    
    $condTrue = [System.Windows.Automation.Condition]::TrueCondition
    $topWindows = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condTrue)
    Write-Output "Top Level (Children) Count: $($topWindows.Count)"
    
    foreach ($win in $topWindows) {
        $n = $win.Current.Name
        if (-not [string]::IsNullOrWhiteSpace($n)) {
            # Log potentially interesting windows
            # Write-Output "Window: $n"
            
            # Search inside this window for the ComboBox
            $condCombo = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::ComboBox)
            $comboInWin = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condCombo)
            if ($comboInWin) {
                if ($comboInWin.Current.Name -like "*Automation Profile*") {
                    Write-Output "Found target ComboBox inside window: '$n'"
                    Test-Element $comboInWin "ComboBox in $n"
                    break
                }
            }
        }
    }
}