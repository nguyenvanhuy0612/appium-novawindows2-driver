import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { NovaWindows2Driver } from '../driver';
import { errors } from '@appium/base-driver';
import { FIND_CHILDREN_RECURSIVELY, PAGE_SOURCE } from './functions';
import { MSAA_HELPER_SCRIPT } from '../powershell/msaa';

const SET_UTF8_ENCODING = /* ps1 */ `$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8`;
// const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; Add-Type -AssemblyName UIAutomationClientsideProviders; Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName PresentationCore; Add-Type -AssemblyName System.Windows.Forms`;
const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `
Add-Type -AssemblyName UIAutomationClient
#Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Windows.Forms
`;
const USE_UI_AUTOMATION_CLIENT = /* ps1 */ `using namespace System.Windows.Automation`;
const INIT_CACHE_REQUEST = /* ps1 */ `($cacheRequest = New-Object System.Windows.Automation.CacheRequest).TreeFilter = [AndCondition]::new([Automation]::ControlViewCondition, [NotCondition]::new([PropertyCondition]::new([AutomationElement]::FrameworkIdProperty, 'Chrome'))); $cacheRequest.Push()`;
const INIT_ROOT_ELEMENT = /* ps1 */ `$rootElement = [AutomationElement]::RootElement`;
const NULL_ROOT_ELEMENT = /* ps1 */ `$rootElement = $null`;
const INIT_ELEMENT_TABLE = /* ps1 */ `$elementTable = New-Object System.Collections.Generic.Dictionary[[string]\`,[AutomationElement]]`;

const COMMAND_END_MARKER = '___NOVA_WIN2_DRIVER_END___';
const COMMAND_END_CHAR = COMMAND_END_MARKER;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Expands Windows environment variables (%VAR%) in a string
 */
function expandEnvironmentVariables(input: string, log: any): string {
    const matches = Array.from(input.matchAll(/%([^%]+)%/g));
    if (matches.length === 0) return input;

    const envVars = [...new Set(matches.map(m => m[1]))];
    log.info(`Expanding environment variables: ${envVars.map(v => `%${v}%`).join(', ')}`);

    let result = input;
    for (const envVar of envVars) {
        const value = process.env[envVar.toUpperCase()] ?? '';
        result = result.replaceAll(`%${envVar}%`, value);
    }
    return result;
}

/**
 * Checks if PowerShell session is ready
 */
function ensureSessionReady(driver: NovaWindows2Driver): void {
    const ps = driver.powerShell;
    if (!ps || ps.exitCode !== null || !ps.stdin.writable) {
        throw new errors.UnknownError('PowerShell session is not available or closed');
    }
}

/**
 * Waits for command completion marker in PowerShell output
 */
function waitForCommandCompletion(
    driver: NovaWindows2Driver,
    powerShell: ChildProcessWithoutNullStreams,
    timeoutMs: number
): Promise<string> {
    return new Promise((resolve, reject) => {
        let timedOut = false;

        const cleanup = () => {
            clearTimeout(timeout);
            powerShell.stdout.off('data', onData);
            powerShell.off('close', onClose);
        };

        const timeout = setTimeout(() => {
            timedOut = true;
            cleanup();
            driver.log.warn(`PowerShell command timed out after ${timeoutMs}ms`);
            try {
                if (driver.powerShell === powerShell) {
                    powerShell.kill();
                    driver.powerShell = undefined;
                }
            } catch (e) {
                driver.log.warn(`Failed to kill PowerShell: ${e}`);
            }
            reject(new errors.TimeoutError(`PowerShell command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const onData = (chunk: any) => {
            // driver.log.debug(`[PS Output] ${chunk.toString().trim()}`);
            if (chunk.toString().includes(COMMAND_END_CHAR)) {
                cleanup();
                if (driver.powerShellStdErr) {
                    driver.log.error(`PowerShell error: ${driver.powerShellStdErr}`);
                    reject(new errors.UnknownError(driver.powerShellStdErr));
                } else {
                    const result = driver.powerShellStdOut.replace(COMMAND_END_CHAR, '').trim();
                    resolve(result);
                }
            }
        };

        const onClose = (code: number | null) => {
            if (timedOut) return;
            cleanup();
            if (driver.powerShell === powerShell) {
                driver.powerShell = undefined;
            }

            if (code === 0) {
                const result = driver.powerShellStdOut.replace(COMMAND_END_CHAR, '').trim();
                resolve(result);
            } else {
                const codeStr = code !== null ? code : 'Unknown';
                const hexCode = code !== null ? '0x' + code.toString(16).toUpperCase() : 'Signal';
                const errorMsg = driver.powerShellStdErr || 'No error details';
                const msg = `PowerShell exited with code ${codeStr} (${hexCode}). stderr: \n${errorMsg}`;
                driver.log.error(msg);
                reject(new errors.UnknownError(msg));
            }
        };

        powerShell.stdout.on('data', onData);
        powerShell.once('close', onClose);
    });
}

// ============================================================================
// Main PowerShell Command Execution
// ============================================================================

/**
 * Executes a PowerShell command in the persistent session
 */
export async function sendPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    if (!this.commandQueue) {
        this.commandQueue = Promise.resolve();
    }

    this.commandQueue = this.commandQueue.then(async () => {
        ensureSessionReady(this);

        this.powerShellStdOut = '';
        this.powerShellStdErr = '';

        try {
            this.powerShell!.stdin.write(`${command}\n`);
            this.powerShell!.stdin.write(`Write-Output "${COMMAND_END_MARKER}"\n`);
        } catch (e: any) {
            throw new errors.UnknownError(`Failed to write to PowerShell: ${e.message}`);
        }

        const timeoutMs = (this.caps as any).powerShellCommandTimeout || 60000;
        return await waitForCommandCompletion(this, this.powerShell!, timeoutMs);
    });

    return await this.commandQueue;
}

/**
 * Executes a PowerShell command in an isolated session
 */
export async function sendIsolatedPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    const powerShell = spawn('powershell.exe', ['-NoProfile', '-Command', command]);

    let stdout = '';
    let stderr = '';

    powerShell.stdout.on('data', chunk => stdout += chunk.toString());
    powerShell.stderr.on('data', chunk => stderr += chunk.toString());

    return new Promise((resolve, reject) => {
        powerShell.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const exitCode = code || -1;
                const hexCode = '0x' + exitCode.toString(16).toUpperCase();
                const error = stderr || 'No error details';
                this.log.error(`Isolated PowerShell exited with code ${exitCode} (${hexCode}). stderr: ${error}`);
                reject(new errors.UnknownError(`PowerShell exited with code ${exitCode} (${hexCode})`));
            }
        });
    });
}

// ============================================================================
// Session Management
// ============================================================================

export async function startPowerShellSession(this: NovaWindows2Driver): Promise<void> {
    this.log.debug('Starting PowerShell session...');

    // Spawn PowerShell process
    const powerShell = spawn('powershell.exe', ['-NoProfile', '-NoExit', '-Command', '-']);
    powerShell.stdout.setEncoding('utf8');
    powerShell.stderr.setEncoding('utf8');

    powerShell.stdout.on('data', (chunk: any) => {
        this.powerShellStdOut += chunk.toString();
    });

    powerShell.stderr.on('data', (chunk: any) => {
        this.powerShellStdErr += chunk.toString();
    });

    this.powerShell = powerShell;

    // Set working directory if specified
    if (this.caps.appWorkingDir) {
        const expandedDir = expandEnvironmentVariables(this.caps.appWorkingDir, this.log);
        this.caps.appWorkingDir = expandedDir;
        await sendPowerShellCommand.call(this, `Set-Location -Path '${expandedDir}'`);
    }

    // Initialize PowerShell environment
    const initScripts = [
        SET_UTF8_ENCODING,
        ADD_NECESSARY_ASSEMBLIES,
        MSAA_HELPER_SCRIPT,
        USE_UI_AUTOMATION_CLIENT,
        INIT_CACHE_REQUEST,
        INIT_ELEMENT_TABLE,
        PAGE_SOURCE,
        FIND_CHILDREN_RECURSIVELY
    ];

    const scriptNames = [
        'SET_UTF8_ENCODING',
        'ADD_NECESSARY_ASSEMBLIES',
        'MSAA_HELPER_SCRIPT',
        'USE_UI_AUTOMATION_CLIENT',
        'INIT_CACHE_REQUEST',
        'INIT_ELEMENT_TABLE',
        'PAGE_SOURCE',
        'FIND_CHILDREN_RECURSIVELY'
    ];

    for (const [index, script] of initScripts.entries()) {
        const scriptName = scriptNames[index] || `Script_${index}`;
        this.log.debug(`[Init] Executing ${scriptName}...`);
        const start = Date.now();
        await sendPowerShellCommand.call(this, script);
        this.log.debug(`[Init] ${scriptName} completed in ${Date.now() - start}ms`);
    }

    // Setup root element based on capabilities
    await setupRootElement.call(this);

    this.log.debug('PowerShell session initialization completed');
}

/**
 * Sets up the root UI element based on capabilities
 */
async function setupRootElement(this: NovaWindows2Driver): Promise<void> {
    const { app, appTopLevelWindow } = this.caps;

    // No app specified
    if ((!app && !appTopLevelWindow) || (!app || app.toLowerCase() === 'none')) {
        this.log.info('No app specified. Setting root element to null.');
        await sendPowerShellCommand.call(this, NULL_ROOT_ELEMENT);
        return;
    }

    // Desktop root
    if (app && app.toLowerCase() === 'root') {
        this.log.info('Setting root element to desktop root.');
        await sendPowerShellCommand.call(this, INIT_ROOT_ELEMENT);
        return;
    }

    // Launch application
    if (app && app.toLowerCase() !== 'none') {
        const expandedApp = expandEnvironmentVariables(app, this.log);
        this.log.info(`Launching application: ${expandedApp}`);
        await this.changeRootElement(expandedApp);
    }

    // Set by window handle
    if (appTopLevelWindow) {
        const handle = Number(appTopLevelWindow);
        if (isNaN(handle)) {
            throw new errors.InvalidArgumentError('Invalid appTopLevelWindow: not a valid window handle');
        }
        await this.changeRootElement(handle);
    }
}

export async function terminatePowerShellSession(this: NovaWindows2Driver): Promise<void> {
    if (!this.powerShell) {
        this.log.debug('PowerShell session already terminated');
        return;
    }

    this.log.debug('Terminating PowerShell session...');

    const powerShell = this.powerShell;
    this.powerShell = undefined;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            this.log.warn('PowerShell did not terminate gracefully, killing process');
            try {
                powerShell.kill('SIGKILL');
            } catch (e) {
                this.log.warn(`Failed to kill PowerShell: ${e}`);
            }
            resolve();
        }, 5000);

        powerShell.once('close', () => {
            clearTimeout(timeout);
            this.log.debug('PowerShell session terminated successfully');
            resolve();
        });

        try {
            powerShell.stdin.end();
        } catch (e) {
            this.log.warn(`Error closing PowerShell stdin: ${e}`);
            clearTimeout(timeout);
            resolve();
        }
    });
}