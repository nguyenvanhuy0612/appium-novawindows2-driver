
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$user32 = Add-Type -MemberDefinition @"
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool IsWindow(IntPtr hWnd);
"@ -Name "User32" -Namespace Win32 -PassThru

function Find-Taskbar {
    Write-Host "Searching for Taskbar..."
    
    # Method 1: FindWindow by Class
    $hwnd = $user32::FindWindow("Shell_TrayWnd", $null)
    if ($hwnd -ne [IntPtr]::Zero) {
        Write-Host "Method 1 (Class) found HWND: $hwnd"
        return $hwnd
    }

    # Method 2: FindWindow by Name
    $hwnd = $user32::FindWindow($null, "Taskbar")
    if ($hwnd -ne [IntPtr]::Zero) {
        Write-Host "Method 2 (Name) found HWND: $hwnd"
        return $hwnd
    }

    # Method 3: Iterate Explorer Windows
    Write-Host "Method 3: Searching Explorer windows..."
    $explorer = Get-Process explorer -ErrorAction SilentlyContinue
    if ($explorer) {
        foreach ($proc in $explorer) {
            # Note: Taskbar doesn't always have a MainWindowHandle we expect
            # We can use Get-Process | ... but for explorer it's better to use UIA Root
        }
    }

    # Method 4: UIA Root Iteration (Raw View)
    Write-Host "Method 4: UIA Root Iteration (Raw View)..."
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($root)
    while ($null -ne $child) {
        if ($child.Current.ClassName -eq "Shell_TrayWnd" -or $child.Current.Name -eq "Taskbar") {
            Write-Host "Method 4 found element via traversal! Name: '$($child.Current.Name)' Class: '$($child.Current.ClassName)'"
            return $child.Current.NativeWindowHandle
        }
        $child = $walker.GetNextSibling($child)
    }

    return [IntPtr]::Zero
}

$hwnd = Find-Taskbar

if ($hwnd -eq [IntPtr]::Zero) {
    Write-Host "Taskbar NOT FOUND after all methods."
    exit
}

Write-Host "Taskbar HWND: $hwnd"
$element = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
if ($null -eq $element) {
    Write-Host "Failed to get AutomationElement from HWND $hwnd"
    exit
}

Write-Host "Got Taskbar Element: Name='$($element.Current.Name)', Class='$($element.Current.ClassName)', ControlType='$($element.Current.ControlType.ProgrammaticName)'"

Write-Host "Inspecting children using RawViewWalker..."
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$child = $walker.GetFirstChild($element)

if ($null -eq $child) {
    Write-Host "RawViewWalker found NO immediate children."
}
else {
    $count = 0
    while ($null -ne $child) {
        $count++
        Write-Host " Child $($count) - Name='$($child.Current.Name)', Class='$($child.Current.ClassName)', ControlType='$($child.Current.ControlType.ProgrammaticName)'"
        $child = $walker.GetNextSibling($child)
    }
}

Write-Host "--- Deep Search for 'Start' button inside Taskbar ---"
function Find-StartBtn {
    param($parent)
    $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
    $child = $walker.GetFirstChild($parent)
    while ($null -ne $child) {
        if ($child.Current.Name -eq "Start" -or $child.Current.AutomationId -eq "StartButton" -or $child.Current.ClassName -match "Button") {
            Write-Host "Potential Match: Name='$($child.Current.Name)', Class='$($child.Current.ClassName)', Autoid='$($child.Current.AutomationId)'"
        }
        if ($child.Current.Name -eq "Start") {
            Write-Host "SUCCESS: Found 'Start' button!"
            return $child
        }
        $sub = Find-StartBtn $child
        if ($sub) { return $sub }
        $child = $walker.GetNextSibling($child)
    }
    return $null
}

$startBtn = Find-StartBtn $element
if ($null -eq $startBtn) {
    Write-Host "FAILURE: 'Start' button not found in descendants of Taskbar (Raw View)."
}
