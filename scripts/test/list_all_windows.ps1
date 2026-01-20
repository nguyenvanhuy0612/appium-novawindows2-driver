
$user32 = Add-Type -MemberDefinition @"
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
"@ -Name "User32Utils" -Namespace Win32 -PassThru

$windows = New-Object System.Collections.Generic.List[PSObject]

$callback = [Win32.User32Utils+EnumWindowsProc] {
    param($hwnd, $lparam)
    
    $classBuilder = New-Object System.Text.StringBuilder 256
    $null = [Win32.User32Utils]::GetClassName($hwnd, $classBuilder, 256)
    
    $textBuilder = New-Object System.Text.StringBuilder 256
    $null = [Win32.User32Utils]::GetWindowText($hwnd, $textBuilder, 256)
    
    $windows.Add([PSCustomObject]@{
            HWND  = $hwnd
            Class = $classBuilder.ToString()
            Title = $textBuilder.ToString()
        })
    return $true
}

[Win32.User32Utils]::EnumWindows($callback, [IntPtr]::Zero)

$windows | Sort-Object Class | Format-Table -AutoSize
