# Powershell script to test UIA vs MSAA property retrieval
# Usage: powershell -File legacy_test.ps1

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

# --- EMBEDDED C# HELPER FOR MSAA (Wrapped in Try/Catch to avoid re-add errors) ---
$csharpCode = @'
using System;
using System.Runtime.InteropServices;
using System.Reflection;

public static class SimpleMSAA {
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    [ComImport]
    [Guid("618736E0-3C3D-11CF-810C-00AA00389B71")]
    [InterfaceType(ComInterfaceType.InterfaceIsDual)]
    private interface IAccessible { } // Minimal definition, we use late binding

    public static object GetProperty(IntPtr hwnd, string propertyName) {
        if (hwnd == IntPtr.Zero) return null;
        
        Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
        object accObj = null;
        int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj); // OBJID_CLIENT = -4 (0xFFFFFFFC)

        if (res == 0 && accObj != null) {
            try {
                // Late binding uses reflection to call get_accName, get_accValue, etc.
                // The first argument to these methods is 'varChild' which is a VARIANT.
                // In C# for COM, this is usually passed as an object (int for CHILDID_SELF = 0).
                
                object[] args = new object[] { (int)0 }; // childId = 0 (Self)
                string memberName = "";

                switch(propertyName) {
                    case "Name": memberName = "accName"; break;
                    case "Value": memberName = "accValue"; break;
                    case "Description": memberName = "accDescription"; break;
                    case "Role": memberName = "accRole"; break; // returns int/object
                    case "State": memberName = "accState"; break; // returns int/object
                    case "Help": memberName = "accHelp"; break;
                    case "KeyboardShortcut": memberName = "accKeyboardShortcut"; break;
                    case "DefaultAction": memberName = "accDefaultAction"; break;
                    default: return null;
                }

                // Use InvokeMember to call the property getter
                object result = accObj.GetType().InvokeMember(memberName, 
                    BindingFlags.GetProperty, 
                    null, accObj, args);
                
                return result;
            } catch (Exception ex) {
                return "Error: " + ex.Message;
            }
        }
        return null;
    }
}
'@

try {
    Add-Type -TypeDefinition $csharpCode -Language CSharp -ErrorAction Stop
}
catch {
    # Ignore if already added in current session
}

# --- HELPER FUNCTION ---
function Test-Element($element, $label) {
    Write-Output "`n=== TARGET FOUND: $label ==="
    try {
        Write-Output "UIA Name: '$($element.Current.Name)'"
        Write-Output "UIA Class: '$($element.Current.ClassName)'"
        Write-Output "UIA AutoId: '$($element.Current.AutomationId)'"
        
        $hwnd = $element.Current.NativeWindowHandle
        Write-Output "Handle: $hwnd"

        # 1. UIA LegacyIAccessiblePattern
        Write-Output "`n--- UIA LegacyIAccessiblePattern ---"
        try {
            $legacy = $element.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)
            if ($legacy) {
                Write-Output "Legacy Name: $($legacy.Current.Name)"
                Write-Output "Legacy Value: $($legacy.Current.Value)"
                Write-Output "Legacy Role: $($legacy.Current.Role)"
            }
            else {
                Write-Output "Legacy Pattern NOT Supported (null)"
            }
        }
        catch {
            Write-Output "Legacy Pattern NOT Supported (Exception)"
        }

        # 2. Direct MSAA
        Write-Output "`n--- Direct MSAA (P/Invoke) ---"
        if ($hwnd -ne 0) {
            Write-Output "MSAA Name: $([SimpleMSAA]::GetProperty($hwnd, 'Name'))"
            Write-Output "MSAA Value: $([SimpleMSAA]::GetProperty($hwnd, 'Value'))"
            Write-Output "MSAA Description: $([SimpleMSAA]::GetProperty($hwnd, 'Description'))"
            Write-Output "MSAA Role: $([SimpleMSAA]::GetProperty($hwnd, 'Role'))"
            Write-Output "MSAA State: $([SimpleMSAA]::GetProperty($hwnd, 'State'))"
            Write-Output "MSAA Help: $([SimpleMSAA]::GetProperty($hwnd, 'Help'))"
            Write-Output "MSAA KeyboardShortcut: $([SimpleMSAA]::GetProperty($hwnd, 'KeyboardShortcut'))"
            Write-Output "MSAA DefaultAction: $([SimpleMSAA]::GetProperty($hwnd, 'DefaultAction'))"
        }
        else {
            Write-Output "No HWND, skipping MSAA."
        }

        # 3. UIA ValuePattern
        Write-Output "`n--- UIA ValuePattern ---"
        try {
            $valPat = $element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
            if ($valPat) {
                Write-Output "ValuePattern Value: $($valPat.Current.Value)"
                Write-Output "ValuePattern IsReadOnly: $($valPat.Current.IsReadOnly)"
            }
            else {
                Write-Output "ValuePattern NOT Supported (null)"
            }
        }
        catch {
            Write-Output "ValuePattern NOT Supported (Exception: $_)"
        }
    }
    catch {
        Write-Output "Error processing element: $_"
    }
}

# --- MAIN EXECUTION ---

$root = [System.Windows.Automation.AutomationElement]::RootElement
Write-Output "Root Element Info:"
Write-Output "  Name: '$($root.Current.Name)'"
Write-Output "  Class: '$($root.Current.ClassName)'"
Write-Output "  Handle: $($root.Current.NativeWindowHandle)"


# --- TEST CASE 1: Start Button ---
$condStart = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "Start")
$startBtn = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condStart)

if ($startBtn) {
    Test-Element $startBtn "Start Button"
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
    Write-Output "Automation Profile22753521 not found."
}

# --- TEST CASE 3: Global TitleBar Search ---
Write-Output "`nSearching for any element with AutomationId='TitleBar' (Global)..."

$condTitleBar = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, "TitleBar")
$allTitleBars = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condTitleBar)

Write-Output "Found $($allTitleBars.Count) 'TitleBar' element(s)."

foreach ($tb in $allTitleBars) {
    $parentName = "Unknown"
    try {
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $parent = $walker.GetParent($tb)
        if ($parent) { $parentName = $parent.Current.Name }
    }
    catch {}
    
    Write-Output " - TitleBar found in Parent: '$parentName' | Class: $($tb.Current.ClassName)"
    
    if ($parentName -like "*Migration Tool") {
        Write-Output "   -> MATCH! Found TitleBar in Secure."
        Test-Element $tb "Secure TitleBar"
    }
}

# --- TEST CASE 4: MSAA Value Verification (Search Box/Edit) ---
Write-Output "`n--- TEST CASE 4: MSAA Value Verification (Search Box/Edit) ---"
$condEdit = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
# We find ALL descendants to pick the first one with a valid Handle
$edits = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condEdit)

$foundHwnd = $false
foreach ($e in $edits) {
    try {
        $h = $e.Current.NativeWindowHandle
        if ($h -ne 0) {
            # Optional: Check if it has a name or looks like a real text box
            Write-Output "Found Edit control with HWND: $h"
            Test-Element $e "Edit Control with HWND"
            $foundHwnd = $true
            break
        }
    }
    catch {}
}

if (-not $foundHwnd) {
    Write-Output "No Edit control with valid HWND found for MSAA Value test."
}
