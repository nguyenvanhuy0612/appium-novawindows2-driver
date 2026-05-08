import { spawn, ChildProcessWithoutNullStreams, execSync } from 'node:child_process';
import { NovaWindows2Driver } from '../driver';
import { errors } from '@appium/base-driver';
import { FIND_CHILDREN_RECURSIVELY, PAGE_SOURCE, FIND_DESCENDANTS_FUNCTIONS } from './functions';
import { WIN32_HELPER_SCRIPT } from '../powershell/win32';
import { decodePwsh } from '../powershell/core';

const SET_UTF8_ENCODING = /* ps1 */ `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8`;
// const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `
// Add-Type -AssemblyName UIAutomationClient
// Add-Type -AssemblyName UIAutomationTypes
// Add-Type -AssemblyName UIAutomationClientsideProviders
// Add-Type -AssemblyName System.Drawing
// Add-Type -AssemblyName PresentationCore
// Add-Type -AssemblyName System.Windows.Forms
// `;
const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `
Add-Type -AssemblyName UIAutomationClient
#Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName System.Windows.Forms
`;
const USE_UI_AUTOMATION_CLIENT = /* ps1 */ `using namespace System.Windows.Automation`;
const INIT_CACHE_REQUEST = /* ps1 */ `
$cacheRequest = New-Object System.Windows.Automation.CacheRequest
$cacheRequest.TreeFilter = [AndCondition]::new([Automation]::ControlViewCondition, [NotCondition]::new([PropertyCondition]::new([AutomationElement]::FrameworkIdProperty, 'Chrome')));
$cacheRequest.Push()
`;
const INIT_ROOT_ELEMENT = /* ps1 */ `$rootElement = [AutomationElement]::RootElement`;
const NULL_ROOT_ELEMENT = /* ps1 */ `$rootElement = $null`;
const INIT_ELEMENT_TABLE = /* ps1 */ `$elementTable = New-Object System.Collections.Generic.Dictionary[[string]\`,[AutomationElement]]`;

const COMMAND_END_MARKER = '___NOVA_WIN2_DRIVER_END___';

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
 * Forcefully kills a process and all its children on Windows.
 * This is critical because certain COM/UIA calls can hang the PowerShell thread
 * in a way that a normal SIGTERM/SIGKILL doesn't clean up children.
 */
function killProcessTree(pid: number, log: any): void {
    try {
        log.debug(`Forcefully killing process tree for PID ${pid}`);
        execSync(`taskkill /F /T /PID ${pid}`);
    } catch (e: any) {
        log.warn(`Failed to kill process tree for PID ${pid}: ${e.message}`);
    }
}

/**
 * Waits for command completion marker in PowerShell output
 */
function waitForCommandCompletion(
    driver: NovaWindows2Driver,
    powerShell: ChildProcessWithoutNullStreams,
    timeoutMs: number,
    command?: string
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
                if (driver.powerShell === powerShell && powerShell.pid) {
                    killProcessTree(powerShell.pid, driver.log);
                    driver.powerShell = undefined;
                }
            } catch (e) {
                driver.log.warn(`Failed to cleanup PowerShell after timeout: ${e}`);
            }
            reject(new errors.TimeoutError(`PowerShell command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const onData = (chunk: any) => {
            // driver.log.debug(`[PS Output] ${chunk.toString().trim()}`);
            if (chunk.toString().includes(COMMAND_END_MARKER)) {
                cleanup();
                // driver.log.debug(`[PS Output] \n${driver.powerShellStdOut}`);
                // driver.log.debug(`[PS Error] \n${driver.powerShellStdErr}`);
                if (driver.powerShellStdErr) {
                    // Many PS pattern calls (SetFocus, InvokePattern, etc.) legitimately
                    // fail and the caller catches and falls back. The full stderr is
                    // already attached to the rejected promise; logging it at error
                    // level was just noise. Demoted to debug.
                    driver.log.debug(`[PowerShell Error] ${driver.powerShellStdErr}`);
                    const decodedCommand = decodePwsh(command || '');
                    driver.log.debug(`[PowerShell Raw Command] \n${decodedCommand}`);
                    reject(new errors.UnknownError(driver.powerShellStdErr));
                } else {
                    const result = driver.powerShellStdOut.replace(COMMAND_END_MARKER, '').trim();
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
                const result = driver.powerShellStdOut.replace(COMMAND_END_MARKER, '').trim();
                resolve(result);
            } else {
                const codeStr = code !== null ? code : 'Unknown';
                const hexCode = code !== null ? '0x' + code.toString(16).toUpperCase() : 'Signal';
                const errorMsg = driver.powerShellStdErr || 'No error details';
                const msg = `[PowerShell Error] Exited with code ${codeStr} (${hexCode}). stderr: \n${errorMsg}`;
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
 * Returns true if the persistent PowerShell process is alive and accepting writes.
 */
function isPowerShellAlive(driver: NovaWindows2Driver): boolean {
    const ps = driver.powerShell;
    return !!ps && ps.exitCode === null && ps.stdin.writable;
}

/**
 * Ensures the persistent PowerShell session is alive. If it has died (e.g.
 * because a user-supplied script destabilised UIA / COM and the process
 * exited on its own), spawn a new one and re-run the init script.
 *
 * Concurrent callers all await the same in-flight restart promise, so a
 * burst of queued commands after a session death triggers exactly one
 * restart. The element table is empty on the new session — stale element
 * IDs surface as NoSuchElement on the next access, which is correct.
 */
async function ensurePowerShellSession(driver: NovaWindows2Driver): Promise<void> {
    if (isPowerShellAlive(driver)) return;
    if (driver.powerShellRestartPromise) {
        await driver.powerShellRestartPromise;
        return;
    }
    driver.log.warn('PowerShell session is not running; auto-restarting...');
    driver.powerShellRestartPromise = (async () => {
        try {
            await startPowerShellSession.call(driver);
            driver.log.info('PowerShell session restored');
        } finally {
            driver.powerShellRestartPromise = undefined;
        }
    })();
    await driver.powerShellRestartPromise;
}

/**
 * Executes a PowerShell command in the persistent session
 */
export async function sendPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    // Pre-queue check: if the session is dead, restart it BEFORE adding to the
    // command queue. We can't restart inside the queue's `.then` because
    // `startPowerShellSession` itself awaits `sendPowerShellCommand` (for the
    // init script + setupRootElement) — that nested call would deadlock waiting
    // on its own outer queue entry.
    await ensurePowerShellSession(this);

    if (!this.commandQueue) {
        this.commandQueue = Promise.resolve();
    }

    this.commandQueue = this.commandQueue.catch((err) => {
        this.log.debug(`[Command Queue] Previous command failed, proceeding with next command. Error: ${err?.message || err}`);
    }).then(async () => {
        // Re-check inside the queue: a previous queued command in this same
        // chain may have killed the session. If so, restart again.
        if (!isPowerShellAlive(this)) {
            await ensurePowerShellSession(this);
        }
        ensureSessionReady(this);

        this.powerShellStdOut = '';
        this.powerShellStdErr = '';

        const writeError = await new Promise<Error | null>((res) => {
            this.powerShell!.stdin.write(`${command}\n`, (err) => err ? res(err) : res(null));
        });
        if (writeError) {
            this.powerShell = undefined;
            throw new errors.UnknownError(`Failed to write to PowerShell: ${writeError.message}`);
        }
        this.powerShell!.stdin.write(`Write-Output "${COMMAND_END_MARKER}"\n`);

        const timeoutMs = (this.caps as any).powerShellCommandTimeout || 60000;
        return await waitForCommandCompletion(this, this.powerShell!, timeoutMs, command);
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

    // Prevent unhandled 'error' events (e.g. EPIPE when PS crashes mid-session)
    // from taking down the Node process. ensureSessionReady() will catch the
    // broken state on the next command.
    powerShell.stdin.on('error', (err: any) => {
        this.log.warn(`PowerShell stdin error (${err.code}): ${err.message}`);
        if (this.powerShell === powerShell) {
            this.powerShell = undefined;
        }
    });

    // Detect unexpected process exit between commands.
    powerShell.on('exit', (code, signal) => {
        if (this.powerShell === powerShell) {
            this.log.warn(`PowerShell exited unexpectedly (code=${code}, signal=${signal})`);
            this.powerShell = undefined;
        }
    });

    this.powerShell = powerShell;

    // Set working directory if specified
    if (this.caps.appWorkingDir) {
        const expandedDir = expandEnvironmentVariables(this.caps.appWorkingDir, this.log);
        this.caps.appWorkingDir = expandedDir;
        await sendPowerShellCommand.call(this, `Set-Location -Path '${expandedDir}'`);
    }

    // Initialize PowerShell environment
    // Combine all scripts into one for faster execution
    // 'using namespace' must be at the beginning of the script, so USE_UI_AUTOMATION_CLIENT comes first
    const combinedScript = [
        USE_UI_AUTOMATION_CLIENT,
        SET_UTF8_ENCODING,
        ADD_NECESSARY_ASSEMBLIES,
        WIN32_HELPER_SCRIPT,
        INIT_CACHE_REQUEST,
        INIT_ELEMENT_TABLE,
        PAGE_SOURCE,
        FIND_CHILDREN_RECURSIVELY,
        FIND_DESCENDANTS_FUNCTIONS
    ].join('\n');

    this.log.info('Initializing PowerShell environment...');
    const start = Date.now();
    await sendPowerShellCommand.call(this, combinedScript);
    this.log.debug(`PowerShell environment initialized in ${Date.now() - start}ms`);

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