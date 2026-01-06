import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MSAA_HELPER_CODE = /* csharp */ `
using System;
using System.Runtime.InteropServices;
using System.Reflection;

public static class MSAAHelper {
    [DllImport("oleacc.dll")]
    private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

    public static object GetLegacyProperty(IntPtr hwnd, string propertyName) {
       if (hwnd == IntPtr.Zero) return null;
       
       Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
       object acc = null;
       // OBJID_CLIENT = 0xFFFFFFFC (-4)
       int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out acc);
       if (res == 0 && acc != null) {
           try {
               // propertyName maps to: accName, accValue, accDescription, accRole, accState, accHelp, accKeyboardShortcut, accDefaultAction
               return acc.GetType().InvokeMember(propertyName, 
                   BindingFlags.GetProperty, 
                   null, 
                   acc, 
                   new object[] { 0 }); // 0 = CHILDID_SELF
           } catch {
               return null;
           }
       }
       return null;
    }

    public static bool SetLegacyValue(IntPtr hwnd, string value) {
       if (hwnd == IntPtr.Zero) return false;
       
       Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
       object acc = null;
       int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out acc);
       if (res == 0 && acc != null) {
           try {
               acc.GetType().InvokeMember("accValue", 
                   BindingFlags.SetProperty, 
                   null, 
                   acc, 
                   new object[] { 0, value }); // 0 = CHILDID_SELF
               return true;
           } catch {
               return false;
           }
       }
       return false;
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

const tempDir = path.resolve(__dirname, '..', 'temp');

if (!fs.existsSync(tempDir)) {
    try {
        fs.mkdirSync(tempDir, { recursive: true });
    } catch (e) {
        // Ignored
    }
}

export type CompilationResult =
    | { type: 'dll', path: string }
    | { type: 'memory', code: string };

let compilationPromise: Promise<CompilationResult> | null = null;

// Helper to get environment with overridden TEMP variables to a local writable dir
function getOverriddenEnv(log?: any): NodeJS.ProcessEnv {
    if (log) {
        log.info(`Overriding TEMP and TMP to ${tempDir}`);
    }
    return { ...process.env, TEMP: tempDir, TMP: tempDir };
}

export async function ensureMsaaHelperCompiled(log: any): Promise<CompilationResult> {
    const sharedDllPath = path.resolve(tempDir, 'MSAAHelper.dll');

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
                    env: getOverriddenEnv(log)
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
            log.warn(`Failed to compile to shared path (${err.message}). Attempting unique fallback...`);
            try {
                const randomId = crypto.randomBytes(4).toString('hex');
                const uniqueDllPath = path.resolve(tempDir, `MSAAHelper_${Date.now()}_${randomId}.dll`);
                await compile(uniqueDllPath);
                return { type: 'dll', path: uniqueDllPath };
            } catch (err2: any) {
                log.warn(`All file-based compilation failed (${err2.message}). Falling back to memory.`);
                return { type: 'memory', code: MSAA_HELPER_CODE };
            }
        }
    })();

    return await compilationPromise;
}

export const getMsaaHelperCode = (result: CompilationResult) => {
    if (result.type === 'dll') {
        return /* ps1 */ `
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            Add-Type -Path '${result.path.replace(/\\/g, '\\\\')}' -ErrorAction Stop
        }
    `;
    } else {
        // In-Memory
        return /* ps1 */ `
        if (-not ([System.Management.Automation.PSTypeName]'MSAAHelper').Type) {
            $code = @'
${result.code}
'@
            Add-Type -TypeDefinition $code -Language CSharp -ErrorAction Stop
        }
    `;
    }
};
