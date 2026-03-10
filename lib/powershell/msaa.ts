import path from 'node:path';

const dllPath = path.resolve(__dirname, '..', 'dll', 'MSAAHelper.dll').replace(/\\/g, '\\\\');
const dllDir = path.resolve(__dirname, '..', 'dll').replace(/\\/g, '\\\\');

export const MSAA_HELPER_SCRIPT = /* ps1 */ `
# MSAA Helper - Self-contained script that compiles and loads the helper

$dllPath = '${dllPath}'
$dllDir = '${dllDir}'

# Check if MSAAHelper is already loaded
if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {

    # Check if DLL exists
    if (Test-Path $dllPath) {
        Write-Output "Loading MSAAHelper from existing DLL: $dllPath"
        Add-Type -Path $dllPath -ErrorAction Stop
    } else {
        Write-Output "Compiling MSAAHelper.dll..."

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

public static class MSAAHelper {
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromPoint(POINT pt, [MarshalAs(UnmanagedType.Interface)] out object ppacc, [MarshalAs(UnmanagedType.Struct)] out object pvarChild);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int x; public int y; }

    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static object GetLegacyProperty(IntPtr hwnd, string propertyName) {
        if (hwnd == IntPtr.Zero) return null;

        Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
        object accObj = null;
        try {
            int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
            if (res == 0 && accObj != null) {
                // childId = 0 (Self)
                object[] args = new object[] { (int)0 };

                string memberName = "";
                switch(propertyName.ToLower()) {
                    case "name": memberName = "accName"; break;
                    case "value": memberName = "accValue"; break;
                    case "description": memberName = "accDescription"; break;
                    case "role": memberName = "accRole"; break;
                    case "state": memberName = "accState"; break;
                    case "help": memberName = "accHelp"; break;
                    case "keyboardshortcut": memberName = "accKeyboardShortcut"; break;
                    case "defaultaction": memberName = "accDefaultAction"; break;
                    case "focus": memberName = "accFocus"; args = null; break;
                    case "selection": memberName = "accSelection"; args = null; break;
                    default: return null;
                }

                object result = accObj.GetType().InvokeMember(memberName,
                    BindingFlags.GetProperty,
                    null, accObj, args);

                return result;
            }
        } catch { }
        finally {
            if (accObj != null) try { System.Runtime.InteropServices.Marshal.ReleaseComObject(accObj); } catch { }
        }
        return null;
    }


    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static object GetLegacyPropertyWithFallback(IntPtr hwnd, int x, int y, string propertyName) {
        // 1. Attempt retrieval using NativeWindowHandle
        if (hwnd != IntPtr.Zero) {
            object val = GetLegacyProperty(hwnd, propertyName);
            if (val != null) return val;
        }

        // 2. Fallback: Attempt retrieval using the element's center point (X, Y)
        POINT pt;
        pt.x = x;
        pt.y = y;
        object accObj = null;
        object childIdObj = null;
        try {
            int res = AccessibleObjectFromPoint(pt, out accObj, out childIdObj);

            if (res == 0 && accObj != null) {
                object[] args = new object[] { childIdObj };
                string memberName = "";
                switch(propertyName.ToLower()) {
                    case "name": memberName = "accName"; break;
                    case "value": memberName = "accValue"; break;
                    case "description": memberName = "accDescription"; break;
                    case "role": memberName = "accRole"; break;
                    case "state": memberName = "accState"; break;
                    case "help": memberName = "accHelp"; break;
                    case "keyboardshortcut": memberName = "accKeyboardShortcut"; break;
                    case "defaultaction": memberName = "accDefaultAction"; break;
                    case "focus": memberName = "accFocus"; args = null; break;
                    case "selection": memberName = "accSelection"; args = null; break;
                    case "childid": return childIdObj;
                    default: return null;
                }

                return accObj.GetType().InvokeMember(memberName,
                    BindingFlags.GetProperty,
                    null, accObj, args);
            }
        } catch { }
        finally {
            if (accObj != null) try { System.Runtime.InteropServices.Marshal.ReleaseComObject(accObj); } catch { }
        }
        return null;
    }

    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static Hashtable GetLegacyPropsWithFallback(IntPtr hwnd, int x, int y) {
        Hashtable props = new Hashtable();
        try {
            string[] propertyNames = { "Name", "Value", "Description", "Role", "State", "Help", "KeyboardShortcut", "DefaultAction", "ChildId" };
            foreach (string propName in propertyNames) {
                object val = GetLegacyPropertyWithFallback(hwnd, x, y, propName);
                if (val != null) {
                    props.Add(propName, val);
                }
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
            Write-Output "MSAAHelper.dll compiled successfully"

            # Load the newly compiled DLL
            Add-Type -Path $dllPath -ErrorAction Stop
            Write-Output "MSAAHelper.dll loaded successfully"
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

Write-Output "MSAAHelper ready"
`;
