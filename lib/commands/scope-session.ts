import { NovaWindows2Driver } from '../driver';
import { pwsh } from '../powershell';

const CHUNK_MS = 5000;

const RESET_SESSION_ROOT_PS = pwsh`$rootElement = [System.Windows.Automation.AutomationElement]::RootElement; "OK"`;

function buildScopeSessionPs(name: string, className: string, chunkMs: number, pollMs: number): string {
    const escapedName = name.replace(/'/g, "''");
    const escapedClass = (className ?? '').replace(/'/g, "''");
    const raw = [
        `$hwnd = [Win32Helper]::FindWindowByName('${escapedName}', '${escapedClass}', ${chunkMs}, ${pollMs})`,
        `if ($hwnd -eq [IntPtr]::Zero) { '' } else {`,
        `    $el = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)`,
        `    if ($null -eq $el) { '' } else {`,
        `        $rootElement = $el`,
        `        "0x{0:X8}" -f $hwnd.ToInt64()`,
        `    }`,
        `}`,
    ].join('\n');
    return pwsh`${raw}`;
}

export async function executeScopeSession(
    this: NovaWindows2Driver,
    args: { name: string; className?: string; timeout?: number; pollMs?: number },
): Promise<string> {
    const { name, className = '#32770', timeout = 60, pollMs = 500 } = args ?? {};
    const totalMs = timeout * 1000;
    const startMs = Date.now();
    let chunk = 0;

    while (true) {
        const remaining = totalMs - (Date.now() - startMs);
        if (remaining <= 0) break;
        chunk++;
        const chunkMs = Math.min(CHUNK_MS, remaining);
        const script = buildScopeSessionPs(name, className, chunkMs, pollMs);
        const result: string = await this.sendPowerShellCommand(script);
        const hwndHex = (result ?? '').trim();
        if (hwndHex) {
            this.log.info(`scopeSession: name=${name} class=${className} -> ${hwndHex} (chunk ${chunk})`);
            return hwndHex;
        }
    }
    this.log.info(`scopeSession: name=${name} class=${className} -> timed out (${chunk} chunks)`);
    return '';
}

export async function executeResetSessionRoot(this: NovaWindows2Driver): Promise<void> {
    await this.sendPowerShellCommand(RESET_SESSION_ROOT_PS);
    this.log.info('resetSessionRoot: root reset to desktop');
}
