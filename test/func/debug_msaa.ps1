
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

# Load MSAA Helper
$dllPath = 'd:\SecureAge\appium-novawindows2-driver\lib\dll\MSAAHelper.dll'
if (Test-Path $dllPath) {
    Add-Type -Path $dllPath
}
else {
    Write-Host "Error: DLL not found at $dllPath"
    exit 1
}

$root = [System.Windows.Automation.AutomationElement]::RootElement
# Search for the specific window
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "File Explorer - 4 running windows pinned")
$el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)

if ($null -eq $el) {
    # Fallback to fuzzy search
    Write-Host "Exact name not found, searching for 'File Explorer'..."
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, "File Explorer", [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase)
    # FindFirst with partial match isn't built-in, so we'll use findAll and filter
    $all = $root.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($item in $all) {
        if ($item.Current.Name -like "*File Explorer*") {
            $el = $item
            break
        }
    }
}

if ($null -eq $el) {
    Write-Host "Element 'File Explorer' not found."
    exit 1
}

Write-Host "Found Element: $($el.Current.Name)"
$hwnd = $el.Current.NativeWindowHandle
Write-Host "HWND: $hwnd"

$rect = $el.Current.BoundingRectangle
$cx = [int]($rect.Left + $rect.Width / 2)
$cy = [int]($rect.Top + $rect.Height / 2)
Write-Host "Rect: $($rect.Left), $($rect.Top), $($rect.Width), $($rect.Height)"
Write-Host "Center Point: ($cx, $cy)"

Write-Host "--- Test: Role ---"
try {
    $val = [MSAAHelper]::GetLegacyPropertyWithFallback([IntPtr]$hwnd, $cx, $cy, "Role")
    Write-Host "Role Result: $val"
    if ($val -ne $null) { Write-Host "Role Type: $($val.GetType().FullName)" }
}
catch {
    Write-Host "Error getting Role: $_"
}

Write-Host "--- Test: Name ---"
try {
    $val = [MSAAHelper]::GetLegacyPropertyWithFallback([IntPtr]$hwnd, $cx, $cy, "Name")
    Write-Host "Name Result: $val"
}
catch {
    Write-Host "Error getting Name: $_"
}

Write-Host "--- Test: State ---"
try {
    $val = [MSAAHelper]::GetLegacyPropertyWithFallback([IntPtr]$hwnd, $cx, $cy, "State")
    Write-Host "State Result: $val"
}
catch {
    Write-Host "Error getting State: $_"
}
