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
        try {
            if (hwnd == IntPtr.Zero) return null;

            Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
            object accObj = null;
            int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);

            if (res == 0 && accObj != null) {
                // childId = 0 (Self)
                object[] args = new object[] { (int)0 };

                string memberName = "";
                switch(propertyName) {
                    case "Name": memberName = "accName"; break;
                    case "Value": memberName = "accValue"; break;
                    case "Description": memberName = "accDescription"; break;
                    case "Role": memberName = "accRole"; break;
                    case "State": memberName = "accState"; break;
                    case "Help": memberName = "accHelp"; break;
                    case "KeyboardShortcut": memberName = "accKeyboardShortcut"; break;
                    case "DefaultAction": memberName = "accDefaultAction"; break;
                    case "Focus": memberName = "accFocus"; args = null; break; // accFocus takes no args? No, it takes no args on interface but prop get might be different. Actually get_accFocus takes no args.
                    case "Selection": memberName = "accSelection"; args = null; break;
                    default: return null;
                }

                object result = accObj.GetType().InvokeMember(memberName, 
                    BindingFlags.GetProperty, 
                    null, accObj, args);

                return result;
            }
        } catch { }
        return null;
    }

    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static bool SetLegacyValue(IntPtr hwnd, string value) {
        try {
            if (hwnd == IntPtr.Zero) return false;

            Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
            object accObj = null;
            int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
            if (res == 0 && accObj != null) {
                // set_accValue(childId, value)
                object[] args = new object[] { (int)0, value };

                accObj.GetType().InvokeMember("accValue", 
                    BindingFlags.SetProperty, 
                    null, accObj, args);

                return true;
            }
        } catch { }
        return false;
    }

    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static Hashtable GetAllLegacyProperties(IntPtr hwnd) {
        Hashtable props = new Hashtable();
        try {
            if (hwnd == IntPtr.Zero) return null;
            string[] propertyNames = { "Name", "Value", "Description", "Role", "State", "Help", "KeyboardShortcut", "DefaultAction" };

            foreach (string propName in propertyNames) {
                try {
                    object value = GetLegacyProperty(hwnd, propName);
                    if (value != null) {
                        props.Add(propName, value);
                    }
                } catch { }
            }

        } catch { }
        return props;
    }

    [HandleProcessCorruptedStateExceptions]
    [SecurityCritical]
    public static Hashtable GetLegacyPropsFromPoint(int x, int y) {
        // Not implemented with Reflection yet, keeping simple return null for now or reusing logic if critical. 
        // User primary focus is Window-based. Keeping it null safe.
        // Or we can try to implement same pattern.
        object accObj = null;
        object childIdObj = null;
        POINT pt;
        pt.x = x;
        pt.y = y;

        int res = AccessibleObjectFromPoint(pt, out accObj, out childIdObj);

        if (res == 0 && accObj != null) {
             Hashtable props = new Hashtable();
             try {
                object[] args = new object[] { childIdObj };
                Type t = accObj.GetType();

                try { props.Add("Name", t.InvokeMember("accName", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("Value", t.InvokeMember("accValue", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("Description", t.InvokeMember("accDescription", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("Role", t.InvokeMember("accRole", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("State", t.InvokeMember("accState", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("Help", t.InvokeMember("accHelp", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("KeyboardShortcut", t.InvokeMember("accKeyboardShortcut", BindingFlags.GetProperty, null, accObj, args)); } catch {}
                try { props.Add("DefaultAction", t.InvokeMember("accDefaultAction", BindingFlags.GetProperty, null, accObj, args)); } catch {}

                return props;
             } catch { return null; }
        }
        return null;
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
