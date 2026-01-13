import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MSAA_HELPER_CODE = /* csharp */ `
using System;
using System.Runtime.InteropServices;
using System.Collections;

public static class MSAAHelper {
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromPoint(POINT pt, [MarshalAs(UnmanagedType.Interface)] out object ppacc, [MarshalAs(UnmanagedType.Struct)] out object pvarChild);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int x; public int y; }

    [ComImport]
    [Guid("618736E0-3C3D-11CF-810C-00AA00389B71")]
    [InterfaceType(ComInterfaceType.InterfaceIsDual)]
    private interface IAccessible {
        [DispId(-5000)] string get_accName([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5001)] string get_accValue([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5001)] void set_accValue([In, MarshalAs(UnmanagedType.Struct)] object varChild, [In, MarshalAs(UnmanagedType.BStr)] string pszValue);
        [DispId(-5002)] string get_accDescription([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5003)] object get_accRole([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5004)] object get_accState([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5005)] string get_accHelp([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5006)] string get_accKeyboardShortcut([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5007)] object get_accFocus();
        [DispId(-5008)] object get_accSelection();
        [DispId(-5009)] string get_accDefaultAction([In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5010)] void accSelect([In] int flagsSelect, [In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5011)] void accLocation(out int pxLeft, out int pyTop, out int pcxWidth, out int pcyHeight, [In, MarshalAs(UnmanagedType.Struct)] object varChild);
        [DispId(-5012)] object accNavigate([In] int navDir, [In, MarshalAs(UnmanagedType.Struct)] object varStart);
        [DispId(-5013)] object accHitTest([In] int xLeft, [In] int yTop);
        [DispId(-5014)] void accDoDefaultAction([In, MarshalAs(UnmanagedType.Struct)] object varChild);
    }

    private static object GetPropertyFromIAccessible(object accessible, string propertyName, object childId) {
        try {
            IAccessible acc = accessible as IAccessible;
            if (acc == null) return null;

            switch (propertyName) {
                case "Name": return acc.get_accName(childId);
                case "Value": return acc.get_accValue(childId);
                case "Description": return acc.get_accDescription(childId);
                case "Role": return acc.get_accRole(childId);
                case "State": return acc.get_accState(childId);
                case "Help": return acc.get_accHelp(childId);
                case "KeyboardShortcut": return acc.get_accKeyboardShortcut(childId);
                case "DefaultAction": return acc.get_accDefaultAction(childId);
                case "Focus": return acc.get_accFocus();
                case "Selection": return acc.get_accSelection();
                default: return null;
            }
        } catch {
            return null;
        }
    }

    public static object GetLegacyProperty(IntPtr hwnd, string propertyName) {
        if (hwnd == IntPtr.Zero) return null;

        Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
        object accObj = null;
        // OBJID_CLIENT = 0xFFFFFFFC (-4)
        int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
        
        if (res == 0 && accObj != null) {
            try {
                return GetPropertyFromIAccessible(accObj, propertyName, 0);
            } catch { }
        }

        return null;
    }

    public static bool SetLegacyValue(IntPtr hwnd, string value) {
       if (hwnd == IntPtr.Zero) return false;

       Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
       object accObj = null;
       int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
       if (res == 0 && accObj != null) {
           try {
               IAccessible acc = (IAccessible)accObj;
               acc.set_accValue(0, value);
               return true;
           } catch {
               return false;
           }
       }
       return false;
    }

    public static Hashtable GetAllLegacyProperties(IntPtr hwnd) {
       if (hwnd == IntPtr.Zero) return null;
       
       Hashtable props = new Hashtable();
       string[] propertyNames = { "Name", "Value", "Description", "Role", "State", "Help", "KeyboardShortcut", "DefaultAction" };

       foreach (string propName in propertyNames) {
           try {
               object value = GetLegacyProperty(hwnd, propName);
               if (value != null) {
                   props.Add(propName, value);
               }
           } catch { }
       }

       return props.Count > 0 ? props : null;
    }

    public static Hashtable GetLegacyPropsFromPoint(int x, int y) {
        object accObj = null;
        object childIdObj = null;
        POINT pt;
        pt.x = x;
        pt.y = y;

        int res = AccessibleObjectFromPoint(pt, out accObj, out childIdObj);
        
        if (res == 0 && accObj != null) {
            Hashtable props = new Hashtable();
            try {
                IAccessible acc = (IAccessible)accObj;
                
                try { props.Add("Name", acc.get_accName(childIdObj)); } catch {}
                try { props.Add("Value", acc.get_accValue(childIdObj)); } catch {}
                try { props.Add("Description", acc.get_accDescription(childIdObj)); } catch {}
                try { props.Add("Role", acc.get_accRole(childIdObj)); } catch {}
                try { props.Add("State", acc.get_accState(childIdObj)); } catch {}
                try { props.Add("Help", acc.get_accHelp(childIdObj)); } catch {}
                try { props.Add("KeyboardShortcut", acc.get_accKeyboardShortcut(childIdObj)); } catch {}
                try { props.Add("DefaultAction", acc.get_accDefaultAction(childIdObj)); } catch {}
                
                return props;
            } catch {
                return null;
            }
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
`;

const dllDir = path.resolve(__dirname, '..', 'dll');

if (!fs.existsSync(dllDir)) {
    try {
        fs.mkdirSync(dllDir, { recursive: true });
    } catch (e: any) {
        throw new Error(`Failed to create DLL directory: ${e.message}`);
    }
}

// Only reference System assemblies - no UI Automation needed
const ASSEMBLY_NAMES = [
    'System'
];

function generateDllLoadScript(dllPath: string): string {
    return /* ps1 */ `
        Write-Output "DEBUG: Loading MSAAHelper from DLL: ${dllPath}";
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            Add-Type -Path '${dllPath.replace(/\\/g, '\\\\')}' -ErrorAction Stop
        }
    `;
}

function generateInMemoryLoadScript(csCode: string): string {
    const assemblyList = ASSEMBLY_NAMES.map(a => `'${a}'`).join(',\n                ');
    return /* ps1 */ `
        Write-Output "DEBUG: Loading MSAAHelper from In-Memory compilation.";
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            $code = @'
${csCode}
'@
            $assemblies = @(
                ${assemblyList}
            )
            Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies $assemblies -ErrorAction Stop
        }
    `;
}

async function compileToDll(targetPath: string, csCode: string): Promise<boolean> {
    const assemblyList = ASSEMBLY_NAMES.map(a => `'${a}'`).join(',\n                    ');
    const compileScript = `
        $dllPath = '${targetPath.replace(/\\/g, '\\\\')}';
        $code = @'
${csCode}
'@;
        $assemblies = @(
            ${assemblyList}
        )
        Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies $assemblies -OutputAssembly $dllPath -ErrorAction Stop
    `;

    return new Promise<boolean>((resolve) => {
        const child = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
            env: { ...process.env, TEMP: dllDir, TMP: dllDir }
        });

        let stderr = '';
        child.stderr.on('data', (chunk) => stderr += chunk.toString());
        child.on('close', (code) => {
            if (code === 0 && fs.existsSync(targetPath)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        child.stdin.write(compileScript);
        child.stdin.end();
    });
}

let compilationPromise: Promise<string> | null = null;

export async function getMsaaHelperScript(log: any): Promise<string> {
    const dllPath = path.resolve(dllDir, 'MSAAHelper.dll');

    // If DLL already exists, use it
    if (fs.existsSync(dllPath)) {
        return generateDllLoadScript(dllPath);
    }

    // If compilation is in progress, wait for it
    if (compilationPromise) {
        return compilationPromise;
    }

    // Start compilation
    compilationPromise = (async () => {
        log.info('Compiling MSAAHelper.dll...');

        const success = await compileToDll(dllPath, MSAA_HELPER_CODE);

        if (success) {
            log.info('MSAAHelper.dll compiled successfully');
            return generateDllLoadScript(dllPath);
        } else {
            log.warn('DLL compilation failed. Falling back to in-memory compilation.');
            return generateInMemoryLoadScript(MSAA_HELPER_CODE);
        }
    })();

    return await compilationPromise;
}
