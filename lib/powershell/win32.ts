import path from 'node:path';

const dllPath = path.resolve(__dirname, '..', 'dll', 'Win32Helper.dll').replace(/\\/g, '\\\\');
const dllDir = path.resolve(__dirname, '..', 'dll').replace(/\\/g, '\\\\');

export const WIN32_HELPER_SCRIPT = /* ps1 */ `
# Win32Helper - Native Win32 helpers compiled as C# DLL
# Provides: window management, MSAA property retrieval, process validation

$dllPath = '${dllPath}'
$dllDir = '${dllDir}'

# Check if Win32Helper is already loaded
if (-not ([System.Management.Automation.PSTypeName]'Win32Helper').Type) {

    # Check if DLL exists
    if (Test-Path $dllPath) {
        Write-Output "Loading Win32Helper from existing DLL: $dllPath"
        Add-Type -Path $dllPath -ErrorAction Stop
    } else {
        Write-Output "Compiling Win32Helper.dll..."

        # Create DLL directory if it doesn't exist
        if (-not (Test-Path $dllDir)) {
            New-Item -ItemType Directory -Path $dllDir -Force | Out-Null
        }

        # C# source code
        $code = @'
using System;
using System.Runtime.InteropServices;
using System.Collections;
using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Security;
using System.Threading;

/// <summary>
/// Native Win32 helper for Appium Windows driver.
///
/// Window management:
///   BringToForeground, SetTopMost, ClearTopMost, MinimizeWindow, RestoreWindow,
///   IsMinimized, IsVisible, GetWindowText, GetWindowRect, GetWindowProcessId
///
/// MSAA property retrieval (with built-in safety):
///   SetExpectedPid           - set expected PID + optional BringToForeground
///   GetLegacyProperty    - single property via hwnd (AccessibleObjectFromWindow)
///   GetLegacyPropertyWithFallback - hwnd -> PID check -> point fallback
///   GetLegacyPropsWithFallback    - batch: all 9 MSAA properties
/// </summary>
public static class Win32Helper {

    // ==================================================================
    // P/Invoke - MSAA (oleacc.dll)
    // ==================================================================

    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(
        IntPtr hwnd, uint dwId, ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromPoint(
        POINT pt,
        [MarshalAs(UnmanagedType.Interface)] out object ppacc,
        [MarshalAs(UnmanagedType.Struct)] out object pvarChild);

    // ==================================================================
    // P/Invoke - Window management (user32.dll)
    // ==================================================================

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern IntPtr WindowFromPoint(POINT pt);

    [DllImport("user32.dll")]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
        int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref uint pvParam, uint fWinIni);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    // ==================================================================
    // Structs and constants
    // ==================================================================

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int x; public int y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT {
        public uint type;
        public INPUTUNION u;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct INPUTUNION {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    private const int SW_MINIMIZE = 6;
    private const int SW_RESTORE = 9;
    private const int SW_SHOW = 5;
    private const ushort VK_MENU = 0xA4;
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SPI_GETFOREGROUNDLOCKTIMEOUT = 0x2000;
    private const uint SPI_SETFOREGROUNDLOCKTIMEOUT = 0x2001;
    private const uint SPIF_SENDWININICHANGE = 0x02;
    private static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    private static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);

    // Context for MSAA queries - set via SetExpectedPid() before calling GetLegacy* methods
    private static uint _expectedPid = 0;

    // ==================================================================
    // Context setup - call before MSAA queries
    // ==================================================================

    /// <summary>
    /// Set expected process ID for MSAA point-based queries.
    /// AccessibleObjectFromPoint will be skipped if the window at the target
    /// coordinates belongs to a different process.
    /// </summary>
    public static void SetExpectedPid(uint expectedPid) {
        _expectedPid = expectedPid;
    }

    /// <summary>
    /// Set expected PID and bring the ancestor window to foreground.
    /// Call before GetLegacyPropsWithFallback for getProperty("all").
    /// </summary>
    public static void SetExpectedPidAndForeground(uint expectedPid, IntPtr ancestorHwnd) {
        _expectedPid = expectedPid;
        if (ancestorHwnd != IntPtr.Zero) {
            BringToForeground(ancestorHwnd);
        }
    }

    // ==================================================================
    // Window management
    // ==================================================================

    /// <summary>
    /// Force a window to foreground even from a background process.
    /// Uses escalating strategies modeled after AutoHotkey WinActivate:
    ///   1. Restore if minimized
    ///   2. AttachThreadInput to foreground + target threads
    ///   3. Retry loop: SetForegroundWindow + BringWindowToTop
    ///   4. SendInput ALT key (satisfies "last input" requirement)
    ///   5. SPI_SETFOREGROUNDLOCKTIMEOUT = 0 (temporarily disable lock)
    ///   6. HWND_TOPMOST toggle (last resort Z-order force)
    /// </summary>
    public static bool BringToForeground(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero || !IsWindow(hwnd)) return false;
        if (GetForegroundWindow() == hwnd) return true;
        if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);

        uint unusedPid = 0;
        uint curThread = GetCurrentThreadId();
        IntPtr foreWnd = GetForegroundWindow();
        uint foreThread = GetWindowThreadProcessId(foreWnd, out unusedPid);
        uint targetThread = GetWindowThreadProcessId(hwnd, out unusedPid);

        bool attachedCurFore = false;
        bool attachedForeTarget = false;

        try {
            if (curThread != foreThread)
                attachedCurFore = AttachThreadInput(curThread, foreThread, true);
            if (foreThread != targetThread)
                attachedForeTarget = AttachThreadInput(foreThread, targetThread, true);

            // Retry with escalation
            for (int attempt = 0; attempt < 5; attempt++) {
                BringWindowToTop(hwnd);
                ShowWindow(hwnd, SW_SHOW);
                SetForegroundWindow(hwnd);
                Thread.Sleep(10);
                if (GetForegroundWindow() == hwnd) return true;

                // ALT key trick via SendInput
                SendAltKey(false);
                SendAltKey(true);
                SetForegroundWindow(hwnd);
                Thread.Sleep(10);
                if (GetForegroundWindow() == hwnd) return true;
            }

            // Temporarily disable foreground lock timeout
            uint lockTimeout = 0;
            SystemParametersInfo(SPI_GETFOREGROUNDLOCKTIMEOUT, 0, ref lockTimeout, 0);
            if (lockTimeout > 0) {
                uint zero = 0;
                SystemParametersInfo(SPI_SETFOREGROUNDLOCKTIMEOUT, 0, ref zero, SPIF_SENDWININICHANGE);
                SetForegroundWindow(hwnd);
                BringWindowToTop(hwnd);
                ShowWindow(hwnd, SW_SHOW);
                SystemParametersInfo(SPI_SETFOREGROUNDLOCKTIMEOUT, 0, ref lockTimeout, SPIF_SENDWININICHANGE);
                Thread.Sleep(10);
                if (GetForegroundWindow() == hwnd) return true;
            }

            // Last resort: TOPMOST toggle
            SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
            return GetForegroundWindow() == hwnd;
        } catch {
            return false;
        } finally {
            if (attachedCurFore) AttachThreadInput(curThread, foreThread, false);
            if (attachedForeTarget) AttachThreadInput(foreThread, targetThread, false);
        }
    }

    /// <summary>Set window as always-on-top.</summary>
    public static bool SetTopMost(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    }

    /// <summary>Remove always-on-top from window.</summary>
    public static bool ClearTopMost(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    }

    public static bool MinimizeWindow(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return ShowWindow(hwnd, SW_MINIMIZE);
    }

    public static bool RestoreWindow(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return ShowWindow(hwnd, SW_RESTORE);
    }

    public static bool IsMinimized(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return IsIconic(hwnd);
    }

    public static bool IsVisible(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return false;
        return IsWindowVisible(hwnd);
    }

    public static string GetText(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return null;
        System.Text.StringBuilder sb = new System.Text.StringBuilder(512);
        GetWindowText(hwnd, sb, sb.Capacity);
        string text = sb.ToString();
        return text.Length > 0 ? text : null;
    }

    public static RECT GetRect(IntPtr hwnd) {
        RECT rect;
        rect.Left = 0; rect.Top = 0; rect.Right = 0; rect.Bottom = 0;
        if (hwnd != IntPtr.Zero) GetWindowRect(hwnd, out rect);
        return rect;
    }

    public static uint GetProcessId(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return 0;
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        return pid;
    }

    private static void SendAltKey(bool keyUp) {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.u.ki.wVk = VK_MENU;
        input.u.ki.dwFlags = keyUp ? KEYEVENTF_KEYUP : (uint)0;
        input.u.ki.dwExtraInfo = IntPtr.Zero;
        SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT)));
    }

    // ==================================================================
    // MSAA property retrieval
    // ==================================================================

    private static bool PointBelongsToExpectedProcess(int x, int y) {
        if (_expectedPid == 0 || (x == 0 && y == 0)) return true;
        try {
            POINT pt; pt.x = x; pt.y = y;
            IntPtr hWnd = WindowFromPoint(pt);
            if (hWnd == IntPtr.Zero) return true;
            uint pidAtPoint = 0;
            GetWindowThreadProcessId(hWnd, out pidAtPoint);
            return pidAtPoint == 0 || pidAtPoint == _expectedPid;
        } catch { return true; }
    }

    private static string ResolveMemberName(string propertyName, out object[] args) {
        args = new object[] { (int)0 };
        switch(propertyName.ToLower()) {
            case "name": return "accName";
            case "value": return "accValue";
            case "description": return "accDescription";
            case "role": return "accRole";
            case "state": return "accState";
            case "help": return "accHelp";
            case "keyboardshortcut": return "accKeyboardShortcut";
            case "defaultaction": return "accDefaultAction";
            case "focus": args = null; return "accFocus";
            case "selection": args = null; return "accSelection";
            default: return null;
        }
    }

    /// <summary>
    /// Get MSAA property via AccessibleObjectFromWindow (hwnd-based, no screen coords).
    /// </summary>
    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static object GetLegacyProperty(IntPtr hwnd, string propertyName) {
        if (hwnd == IntPtr.Zero) return null;
        Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
        object accObj = null;
        try {
            int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
            if (res == 0 && accObj != null) {
                object[] args;
                string memberName = ResolveMemberName(propertyName, out args);
                if (memberName == null) return null;
                return accObj.GetType().InvokeMember(memberName,
                    BindingFlags.GetProperty, null, accObj, args);
            }
        } catch { }
        finally {
            if (accObj != null) try { Marshal.ReleaseComObject(accObj); } catch { }
        }
        return null;
    }

    /// <summary>
    /// Get MSAA property with cascading fallback:
    ///   1. hwnd-based (AccessibleObjectFromWindow)
    ///   2. PID validation (WindowFromPoint check)
    ///   3. Point-based (AccessibleObjectFromPoint)
    /// Call SetExpectedPid() first to set expected PID.
    /// </summary>
    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static object GetLegacyPropertyWithFallback(IntPtr hwnd, int x, int y, string propertyName) {
        if (hwnd != IntPtr.Zero) {
            object val = GetLegacyProperty(hwnd, propertyName);
            if (val != null) return val;
        }
        if (!PointBelongsToExpectedProcess(x, y)) return null;
        if (propertyName.ToLower() == "childid") { /* handled below */ }

        POINT pt; pt.x = x; pt.y = y;
        object accObj = null;
        object childIdObj = null;
        try {
            int res = AccessibleObjectFromPoint(pt, out accObj, out childIdObj);
            if (res == 0 && accObj != null) {
                if (propertyName.ToLower() == "childid") return childIdObj;
                object[] args;
                string memberName = ResolveMemberName(propertyName, out args);
                if (memberName == null) return null;
                if (args != null) args = new object[] { childIdObj };
                return accObj.GetType().InvokeMember(memberName,
                    BindingFlags.GetProperty, null, accObj, args);
            }
        } catch { }
        finally {
            if (accObj != null) try { Marshal.ReleaseComObject(accObj); } catch { }
        }
        return null;
    }

    /// <summary>
    /// Get all MSAA properties at once.
    /// Call SetExpectedPid() first to set expected PID.
    /// </summary>
    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static Hashtable GetLegacyPropsWithFallback(IntPtr hwnd, int x, int y) {
        Hashtable props = new Hashtable();
        try {
            string[] names = { "Name", "Value", "Description", "Role", "State",
                               "Help", "KeyboardShortcut", "DefaultAction", "ChildId" };
            foreach (string name in names) {
                object val = GetLegacyPropertyWithFallback(hwnd, x, y, name);
                if (val != null) props.Add(name, val);
            }
        } catch { }
        return props;
    }
}

public static class ConsoleHelper {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);

    public const int STD_INPUT_HANDLE = -10;
    public const uint ENABLE_MOUSE_INPUT = 0x0010;
    public const uint ENABLE_INSERT_MODE = 0x0020;
    public const uint ENABLE_QUICK_EDIT_MODE = 0x0040;
    public const uint ENABLE_EXTENDED_FLAGS = 0x0080;

    public static void DisableConsoleInteractions() {
        IntPtr consoleHandle = GetStdHandle(STD_INPUT_HANDLE);
        uint mode;
        if (GetConsoleMode(consoleHandle, out mode)) {
            mode &= ~ENABLE_QUICK_EDIT_MODE;
            mode &= ~ENABLE_INSERT_MODE;
            mode &= ~ENABLE_MOUSE_INPUT;
            mode |= ENABLE_EXTENDED_FLAGS;
            SetConsoleMode(consoleHandle, mode);
        }
    }
}
'@

        # Set TEMP and TMP to DLL directory to avoid permission issues
        $originalTemp = $env:TEMP
        $originalTmp = $env:TMP
        $env:TEMP = $dllDir
        $env:TMP = $dllDir

        try {
            # Compile the C# code to DLL
            Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies @('System') -OutputAssembly $dllPath -ErrorAction Stop
            Write-Output "Win32Helper.dll compiled successfully"

            # Load the newly compiled DLL
            Add-Type -Path $dllPath -ErrorAction Stop
            Write-Output "Win32Helper.dll loaded successfully"
        } catch {
            Write-Output "Compilation failed, falling back to in-memory loading"
            # Fallback: load in-memory if compilation fails
            Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies @('System') -ErrorAction Stop
        } finally {
            # Restore original TEMP/TMP
            $env:TEMP = $originalTemp
            $env:TMP = $originalTmp
        }
    }
}

Write-Output "Win32Helper ready"
`;
