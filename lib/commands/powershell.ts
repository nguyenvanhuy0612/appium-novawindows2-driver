import { spawn, ChildProcessWithoutNullStreams, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { NovaWindows2Driver } from '../driver';
import { errors } from '@appium/base-driver';
import { FIND_CHILDREN_RECURSIVELY, PAGE_SOURCE, FIND_DESCENDANTS_FUNCTIONS } from './functions';
import { WIN32_HELPER_SCRIPT } from '../powershell/win32';
import { decodePwsh } from '../powershell/core';

const SET_UTF8_ENCODING = /* ps1 */ `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8`;
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

const MARKER_PREFIX = '___NOVA_END_';
const MARKER_SUFFIX = '___';

// ============================================================================
// Per-command context
// ============================================================================

/**
 * Holds the in-flight command's accumulated stdout/stderr plus the unique
 * marker used to detect command completion. The driver-level stdout/stderr
 * listeners (installed once in startPowerShellSession) push chunks into the
 * active context and call check() so waitForCommandCompletion can re-test
 * the buffers for the completion markers.
 */
export interface CommandContext {
    stdout: string;
    stderr: string;
    marker: string;
    check: () => void;
}

function newMarker(): string {
    return `${MARKER_PREFIX}${randomUUID().replace(/-/g, '')}${MARKER_SUFFIX}`;
}

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
 * Critical because COM/UIA calls can hang the PS thread in a way that a
 * plain TerminateProcess doesn't clean up spawned children.
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
 * Sends a command through the framing protocol and resolves when both the
 * stdout AND stderr completion markers have been observed (or rejects on
 * stderr, timeout, or process death).
 *
 * The dual-marker design solves the stdout/stderr ordering race: PS may
 * write to stderr AFTER it writes the stdout marker, so resolving on the
 * stdout marker alone risks reporting "success" while error text is still
 * in flight (and would later bleed into the next command's buffer).
 */
function waitForCommandCompletion(
    driver: NovaWindows2Driver,
    powerShell: ChildProcessWithoutNullStreams,
    command: string,
    timeoutMs: number
): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const marker = newMarker();
        let settled = false;
        const startedAt = Date.now();

        const ctx: CommandContext = {
            stdout: '',
            stderr: '',
            marker,
            check: () => check(),
        };

        const cleanup = () => {
            settled = true;
            clearTimeout(timeout);
            powerShell.off('close', onClose);
            if (driver.powerShellCommandContext === ctx) {
                driver.powerShellCommandContext = undefined;
            }
        };

        const stripMarker = (text: string): string =>
            text.replace(marker, '').trimEnd();

        const check = () => {
            if (settled) return;
            if (!ctx.stdout.includes(marker)) return;
            if (!ctx.stderr.includes(marker)) return;

            cleanup();
            const stderrText = stripMarker(ctx.stderr);
            const stdoutText = stripMarker(ctx.stdout).trim();

            const elapsedMs = Date.now() - startedAt;
            const shortCmd = `${command.slice(0, 80)}${command.length > 80 ? '…' : ''}`;

            // Native-exe failure: our $LASTEXITCODE injection emitted
            // "[NativeExit] N" on stderr. ALWAYS a failure regardless of
            // treatStderrAsError — caller asked PS to run a native exe and
            // it exited non-zero, that's unambiguously bad.
            const nativeExitMatch = stderrText.match(/^\[NativeExit\]\s+(-?\d+)\s*$/m);
            if (nativeExitMatch) {
                const nativeCode = nativeExitMatch[1];
                const otherStderr = stderrText
                    .replace(/^\[NativeExit\]\s+-?\d+\s*$/m, '')
                    .trim();
                const msg = otherStderr
                    ? `Native command exited with code ${nativeCode}. stderr: ${otherStderr}`
                    : `Native command exited with code ${nativeCode}`;
                driver.log.debug(`[PS Command Failed] (${elapsedMs}ms) ${shortCmd}`);
                driver.log.debug(`[PowerShell Raw Command] \n${decodePwsh(command)}`);
                reject(new errors.UnknownError(msg));
                return;
            }

            if (stderrText) {
                const treatAsError = (driver.caps as any).treatStderrAsError !== false;
                if (treatAsError) {
                    driver.log.debug(`[PS Command Failed] (${elapsedMs}ms) ${shortCmd}`);
                    driver.log.debug(`[PowerShell Error] ${stderrText}`);
                    driver.log.debug(`[PowerShell Raw Command] \n${decodePwsh(command)}`);
                    reject(new errors.UnknownError(stderrText));
                    return;
                }
                driver.log.debug(`[PS stderr ignored, treatStderrAsError=false] ${stderrText}`);
            }

            driver.log.debug(`[PS Command OK] (${elapsedMs}ms) ${shortCmd}`);
            resolve(stdoutText);
        };

        const timeout = setTimeout(() => {
            if (settled) return;
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

        const onClose = (code: number | null) => {
            if (settled) return;
            cleanup();
            if (driver.powerShell === powerShell) {
                driver.powerShell = undefined;
            }

            if (driver.powerShellTerminating) {
                // Intentional teardown - the rejection here would float up as
                // an unhandled rejection. Resolve silently.
                driver.log.debug('PowerShell process closed during session teardown');
                resolve('');
                return;
            }

            // Code 0 mid-command: PS exited cleanly without ever emitting
            // the markers. Either the user issued `exit 0` in their command,
            // or stdin was closed externally. Still a failure of THIS
            // command (the markers never arrived), but the previous log
            // line "[PowerShell Error] Exited with code 0" was misleading.
            if (code === 0) {
                const msg = 'PowerShell process exited cleanly mid-command before completion markers arrived';
                driver.log.warn(msg);
                reject(new errors.UnknownError(msg));
                return;
            }

            const codeDisplay = code !== null
                ? `${code} (0x${(code >>> 0).toString(16).toUpperCase()})`
                : 'killed by signal';
            const errorMsg = ctx.stderr || 'No error details';
            const msg = `[PowerShell Error] Exited with code ${codeDisplay}. stderr: \n${errorMsg}`;
            driver.log.error(msg);
            reject(new errors.UnknownError(msg));
        };

        // Install context BEFORE writing so we don't miss any output that may
        // already be in the OS pipe from earlier inter-command bytes.
        driver.powerShellCommandContext = ctx;
        powerShell.once('close', onClose);

        // Write the framed command as five lines:
        //   1. $LASTEXITCODE = 0        - reset the native-exit slot so we
        //                                 don't pick up a stale value from
        //                                 an earlier command in the session.
        //   2. & { <user command> }     - subshell wrap prevents an open
        //                                 pipe/brace from absorbing the
        //                                 marker lines.
        //   3. if ($LASTEXITCODE -ne 0) { ... } - if the user command
        //                                 invoked a native exe that exited
        //                                 non-zero, surface that as a
        //                                 "[NativeExit] N" line on stderr so
        //                                 check() can detect it. PS cmdlet
        //                                 failures don't touch
        //                                 $LASTEXITCODE; they already write
        //                                 to stderr.
        //   4. Write-Output "<marker>"  - stdout completion marker.
        //   5. [Console]::Error.WriteLine("<marker>") - stderr completion
        //                                 marker; resolving on both ensures
        //                                 any stderr from the command is
        //                                 flushed before we return.
        //
        // EPIPE on any of these writes lands on the stdin 'error' handler
        // installed in startPowerShellSession, which clears driver.powerShell.
        // The pending command then surfaces the failure via onClose or the
        // command timeout — no per-write callback needed.
        try {
            powerShell.stdin.write(`$LASTEXITCODE = 0\n`);
            powerShell.stdin.write(`& { ${command} }\n`);
            powerShell.stdin.write(`if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { [Console]::Error.WriteLine("[NativeExit] $LASTEXITCODE") }\n`);
            powerShell.stdin.write(`Write-Output "${marker}"\n`);
            powerShell.stdin.write(`[Console]::Error.WriteLine("${marker}")\n`);
        } catch (e: any) {
            if (!settled) {
                cleanup();
                if (driver.powerShell === powerShell) {
                    driver.powerShell = undefined;
                }
                reject(new errors.UnknownError(`Failed to write to PowerShell: ${e?.message ?? e}`));
            }
        }
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
    // Refuse to restart during teardown. Without this, queued commands that
    // arrive after terminatePowerShellSession would happily respawn a fresh
    // PS process, defeating the session delete.
    if (driver.powerShellTerminating) {
        throw new errors.NoSuchDriverError(
            'PowerShell session is being terminated; refusing to start a new one'
        );
    }
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
        // Teardown may have started while we were waiting our turn in the
        // queue. Bail before doing any I/O so we don't trigger an auto-
        // restart of the very process the session is trying to terminate.
        if (this.powerShellTerminating) {
            throw new errors.NoSuchDriverError(
                'PowerShell session is being terminated'
            );
        }
        // If PS died between our pre-queue check and our turn, fail this
        // single command. The next sendPowerShellCommand call will hit
        // ensurePowerShellSession (pre-queue) and restart cleanly — which
        // avoids the deadlock that would occur if we tried to restart from
        // inside the queue (startPowerShellSession's own init commands
        // await the queue we are currently holding).
        ensureSessionReady(this);

        const timeoutMs = (this.caps as any).powerShellCommandTimeout || 60000;
        return await waitForCommandCompletion(this, this.powerShell!, command, timeoutMs);
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
        powerShell.on('error', (err: any) => {
            this.log.error(`Isolated PowerShell spawn error: ${err.message}`);
            reject(new errors.UnknownError(`Failed to spawn PowerShell: ${err.message}`));
        });
        powerShell.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const codeDisplay = code !== null
                    ? `${code} (0x${(code >>> 0).toString(16).toUpperCase()})`
                    : 'killed by signal';
                const error = stderr || 'No error details';
                this.log.error(`Isolated PowerShell exited with ${codeDisplay}. stderr: ${error}`);
                reject(new errors.UnknownError(`PowerShell exited with ${codeDisplay}`));
            }
        });
    });
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Init script broken into named stages. Each stage is sent as its own framed
 * command so a failure surfaces with the stage name, and per-stage timing
 * shows up in the debug log.
 */
const INIT_STAGES: ReadonlyArray<{ name: string; script: string }> = [
    { name: 'utf8-encoding', script: SET_UTF8_ENCODING },
    { name: 'using-namespace', script: USE_UI_AUTOMATION_CLIENT },
    { name: 'add-assemblies', script: ADD_NECESSARY_ASSEMBLIES },
    { name: 'win32-helper', script: WIN32_HELPER_SCRIPT },
    { name: 'cache-request', script: INIT_CACHE_REQUEST },
    { name: 'element-table', script: INIT_ELEMENT_TABLE },
    { name: 'page-source', script: PAGE_SOURCE },
    { name: 'find-children', script: FIND_CHILDREN_RECURSIVELY },
    { name: 'find-descendants', script: FIND_DESCENDANTS_FUNCTIONS },
];

export async function startPowerShellSession(this: NovaWindows2Driver): Promise<void> {
    this.log.debug('Starting PowerShell session...');

    // -NoExit is intentionally OMITTED: with `-Command -` we want PS to exit
    // when stdin closes, which is how terminatePowerShellSession requests a
    // graceful shutdown. Earlier code had -NoExit, which kept PS alive past
    // stdin EOF and forced every shutdown down the SIGKILL fallback path.
    const powerShell = spawn('powershell.exe', ['-NoProfile', '-Command', '-']);
    powerShell.stdout.setEncoding('utf8');
    powerShell.stderr.setEncoding('utf8');

    // Driver-level dispatchers: route every chunk into the active command's
    // context. Output between commands (none expected in normal flow) is
    // logged for diagnostics rather than silently discarded.
    powerShell.stdout.on('data', (chunk: any) => {
        const text = chunk.toString();
        const ctx = this.powerShellCommandContext;
        if (ctx) {
            ctx.stdout += text;
            ctx.check();
        } else if (text.trim()) {
            this.log.debug(`[PS inter-command stdout] ${text.trim()}`);
        }
    });

    powerShell.stderr.on('data', (chunk: any) => {
        const text = chunk.toString();
        const ctx = this.powerShellCommandContext;
        if (ctx) {
            ctx.stderr += text;
            ctx.check();
        } else if (text.trim()) {
            this.log.debug(`[PS inter-command stderr] ${text.trim()}`);
        }
    });

    // Prevent unhandled 'error' events (e.g. EPIPE when PS crashes mid-session)
    // from taking down the Node process. ensureSessionReady() catches the
    // broken state on the next command.
    powerShell.stdin.on('error', (err: any) => {
        this.log.warn(`PowerShell stdin error (${err.code}): ${err.message}`);
        if (this.powerShell === powerShell) {
            this.powerShell = undefined;
        }
    });

    // Process-level 'error' (spawn failure, ENOENT for powershell.exe, etc.).
    // Without a listener this would crash the Node process.
    powerShell.on('error', (err: any) => {
        this.log.error(`PowerShell process error: ${err.message}`);
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
    this.powerShellTerminating = false;

    try {
        // Set working directory if specified
        if (this.caps.appWorkingDir) {
            const expandedDir = expandEnvironmentVariables(this.caps.appWorkingDir, this.log);
            this.caps.appWorkingDir = expandedDir;
            await sendPowerShellCommand.call(this, `Set-Location -Path '${expandedDir}'`);
        }

        // Initialise PS environment one stage at a time. Failures point to
        // the offending stage; timings highlight slow ones.
        this.log.info('Initializing PowerShell environment...');
        const initStart = Date.now();
        for (const stage of INIT_STAGES) {
            const stageStart = Date.now();
            try {
                await sendPowerShellCommand.call(this, stage.script);
            } catch (e: any) {
                throw new errors.UnknownError(
                    `PowerShell init stage '${stage.name}' failed: ${e?.message ?? e}`
                );
            }
            this.log.debug(`  init stage '${stage.name}' completed in ${Date.now() - stageStart}ms`);
        }
        this.log.debug(`PowerShell environment initialized in ${Date.now() - initStart}ms`);

        // Setup root element based on capabilities
        await setupRootElement.call(this);

        this.log.debug('PowerShell session initialization completed');
    } catch (e) {
        // Init or root-element setup failed. Tear down the spawned PS process
        // so this.powerShell doesn't point at a half-initialised session that
        // the next sendPowerShellCommand would happily try to use.
        this.log.warn(`PowerShell session init failed, cleaning up: ${(e as any)?.message ?? e}`);
        try {
            if (powerShell.pid) {
                killProcessTree(powerShell.pid, this.log);
            }
        } catch {
            // best effort
        }
        if (this.powerShell === powerShell) {
            this.powerShell = undefined;
        }
        throw e;
    }
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
    this.powerShellTerminating = true;

    const powerShell = this.powerShell;
    this.powerShell = undefined;

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            this.log.warn('PowerShell did not terminate gracefully, killing process tree');
            try {
                if (powerShell.pid) {
                    // taskkill /T kills the whole tree, which is the right
                    // thing to do here: PS may have spawned child exes that
                    // a plain TerminateProcess on the PS host would orphan.
                    killProcessTree(powerShell.pid, this.log);
                } else {
                    powerShell.kill('SIGKILL');
                }
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
