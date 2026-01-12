import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MSAA_HELPER_CODE = /* csharp */ `
using System;
using System.Runtime.InteropServices;
using System.Reflection;
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

    public static object GetLegacyProperty(IntPtr hwnd, string propertyName) {
       if (hwnd == IntPtr.Zero) return null;
       
       Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
       object accObj = null;
       // OBJID_CLIENT = 0xFFFFFFFC (-4)
       int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
       if (res == 0 && accObj != null) {
           try {
               IAccessible acc = (IAccessible)accObj;
               // CHILDID_SELF = 0
               object childId = 0;

               switch (propertyName) {
                   case "accName": return acc.get_accName(childId);
                   case "accValue": return acc.get_accValue(childId);
                   case "accDescription": return acc.get_accDescription(childId);
                   case "accRole": return acc.get_accRole(childId);
                   case "accState": return acc.get_accState(childId);
                   case "accHelp": return acc.get_accHelp(childId);
                   case "accKeyboardShortcut": return acc.get_accKeyboardShortcut(childId);
                   case "accDefaultAction": return acc.get_accDefaultAction(childId);
                   // Some properties don't take childId or behave differently, but for standard element props:
                   case "accFocus": return acc.get_accFocus();
                   case "accSelection": return acc.get_accSelection();
                   default: return null;
               }
           } catch {
               return null;
           }
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
               acc.set_accValue(0, value); // 0 = CHILDID_SELF
               return true;
           } catch {
               return false;
           }
       }
       return false;
    }

    public static Hashtable GetAllLegacyProperties(IntPtr hwnd) {
       if (hwnd == IntPtr.Zero) return null;
       
       Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
       object accObj = null;
       int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out accObj);
       if (res == 0 && accObj != null) {
           Hashtable props = new Hashtable();
           try {
               IAccessible acc = (IAccessible)accObj;
               object childId = 0; // CHILDID_SELF

               try { props.Add("Name", acc.get_accName(childId)); } catch {}
               try { props.Add("Value", acc.get_accValue(childId)); } catch {}
               try { props.Add("Description", acc.get_accDescription(childId)); } catch {}
               try { props.Add("Role", acc.get_accRole(childId)); } catch {}
               try { props.Add("State", acc.get_accState(childId)); } catch {}
               try { props.Add("Help", acc.get_accHelp(childId)); } catch {}
               try { props.Add("KeyboardShortcut", acc.get_accKeyboardShortcut(childId)); } catch {}
               try { props.Add("DefaultAction", acc.get_accDefaultAction(childId)); } catch {}
               
               return props;
           } catch {
               return null;
           }
       }
       return null;
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
    } catch (e) {
        throw new Error(`Failed to create DLL directory: ${e.message}`);
    }
}

export type CompilationResult =
    | { type: 'dll', path: string }
    | { type: 'memory', code: string };

let compilationPromise: Promise<CompilationResult> | null = null;

export async function ensureMsaaHelperCompiled(log: any): Promise<CompilationResult> {
    const sharedDllPath = path.resolve(dllDir, 'MSAAHelper.dll');

    if (fs.existsSync(sharedDllPath)) {
        return { type: 'dll', path: sharedDllPath };
    }

    if (compilationPromise) {
        return compilationPromise;
    }

    compilationPromise = (async () => {
        log.info(`Compiling MSAAHelper.dll...`);
        const csContent = MSAA_HELPER_CODE;

        // Helper to run compilation
        const compile = async (targetDllPath: string): Promise<void> => {
            const compileScript = `
                $dllPath = '${targetDllPath.replace(/\\/g, '\\\\')}';
                $code = @'
${csContent}
'@;
                Add-Type -TypeDefinition $code -Language CSharp -OutputAssembly $dllPath -ErrorAction Stop
            `;

            return new Promise<void>((resolve, reject) => {
                const child = spawn('powershell.exe', ['-NoProfile', '-Command', '-'], {
                    env: { ...process.env, TEMP: dllDir, TMP: dllDir }
                });
                let stderr = '';
                child.stderr.on('data', (c) => stderr += c.toString());
                child.on('close', (code) => {
                    if (code === 0 && fs.existsSync(targetDllPath)) {
                        resolve();
                    } else {
                        reject(new Error(`Exit code ${code}: ${stderr}`));
                    }
                });
                child.stdin.write(compileScript);
                child.stdin.end();
            });
        };

        try {
            await compile(sharedDllPath);
            return { type: 'dll', path: sharedDllPath };
        } catch (err: any) {
            log.warn(`File compilation failed (${err.message}). Falling back to memory.`);
            return { type: 'memory', code: MSAA_HELPER_CODE };
        }
    })();

    return await compilationPromise;
}

export const getMsaaHelperCode = (result: CompilationResult) => {
    if (result.type === 'dll') {
        return /* ps1 */ `
        Write-Output "DEBUG: Loading MSAAHelper from DLL: ${result.path}";
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            Add-Type -Path '${result.path.replace(/\\/g, '\\\\')}' -ErrorAction Stop
        }
    `;
    } else {
        // In-Memory
        return /* ps1 */ `
        Write-Output "DEBUG: Loading MSAAHelper from In-Memory compilation.";
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            $code = @'
${result.code}
'@
            Add-Type -TypeDefinition $code -Language CSharp -ErrorAction Stop
        }
    `;
    }
};

ensureMsaaHelperCompiled(console).catch((e: any) => {
    console.warn(`[NovaWindows2] Background compilation check failed: ${e.message}`);
});
