import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
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
/**
 * Maximum number of UIA elements cached in the PS-side `$elementTable`.
 *
 * Hit on long-running sessions that issue many findAll calls (each saves
 * every returned element). Pre-1.1.17 the table grew unboundedly, holding
 * dead UIA COM proxies that the runtime can't GC eagerly. Eventually PS
 * threw OOM (separate from the FindAll(Subtree) OOM fixed in A14).
 *
 * 10 000 entries is generous for a single test; bounded so a poll-loop
 * session can't blow PS memory. Eviction is FIFO over insertion order.
 * When a client references an evicted ID, `ensureElementResolved` re-finds
 * the element by its runtime ID and re-caches it transparently (one extra
 * UIA call, no test-visible failure unless the underlying element is gone).
 */
const ELEMENT_TABLE_MAX = 10_000;

const INIT_ELEMENT_TABLE = /* ps1 */ `
$elementTable = New-Object System.Collections.Generic.Dictionary[[string]\`,[AutomationElement]]
$elementTableOrder = New-Object System.Collections.Generic.Queue[string]
$ELEMENT_TABLE_MAX = ${ELEMENT_TABLE_MAX}
`;

const MARKER_PREFIX = '___NOVA_END_';
const MARKER_SUFFIX = '___';

/**
 * Default cap on a single PowerShell command's wall-clock time.
 *
 * Bumped from 60s -> 300s in 1.1.14 after production failures on SecureAge:
 *   - SecureAge UIA queries can be ~500ms per property (see secureage_slow_uia
 *     memory note). A FindFirst that walks ~100 elements on a complex dialog
 *     hits ~50s; ~200 elements hits ~100s; pathological scopes can exceed
 *     that. 60s was borderline; 120s still occasionally clipped real work.
 *     300s is a generous ceiling that should only fire on a genuine hang.
 *   - Longer timeouts are now cheap: killProcessTree is non-blocking, so a
 *     stuck command no longer freezes Appium's event loop while it's being
 *     killed. The only cost of a higher cap is a slower failure when a
 *     command genuinely hangs.
 *
 * Tests / specific callers that care about a tighter ceiling should pass
 * `appium:powerShellCommandTimeout` in caps.
 */
export const DEFAULT_POWERSHELL_COMMAND_TIMEOUT_MS = 300_000;

/**
 * Maximum number of in-flight + queued PS commands per session.
 *
 * Hit when a client sends commands faster than the PS subprocess can
 * drain them (poll loops with no debounce, parallel finds, runaway test
 * harness, etc.). Without a cap, the commandQueue Promise chain grows
 * unboundedly: each pending entry holds command bytes, the marker UUID,
 * onClose handler refs, and prolongs graceful shutdown.
 *
 * 200 is high enough that legitimate test bursts pass through but low
 * enough that a runaway client surfaces as a clear error after a couple
 * of seconds instead of accumulating for minutes. New commands above the
 * cap reject with UnknownError; the queued commands continue to drain
 * normally.
 */
export const MAX_POWERSHELL_QUEUE_DEPTH = 200;

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
    /**
     * Indices we've already scanned for the marker in each buffer. Used by
     * `check()` to avoid re-scanning the whole accumulated buffer on every
     * data chunk (which would be O(n²) for large outputs). We back up by
     * `marker.length - 1` from the end of the prior buffer before scanning
     * the new tail, so a marker straddling a chunk boundary is still found.
     */
    stdoutScanIdx: number;
    stderrScanIdx: number;
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
        // spawn + unref so the kill is fire-and-forget — execSync would block
        // the Node.js event loop (sometimes for several seconds on Windows when
        // the target process holds COM/UIA resources), causing TCP connect
        // timeouts on any Appium request that arrives during the wait.
        const child = spawn('taskkill', ['/F', '/T', '/PID', String(pid)], {
            stdio: 'ignore',
            detached: true,
        });
        child.unref();
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
            stdoutScanIdx: 0,
            stderrScanIdx: 0,
            check: () => check(),
        };

        // Memoised marker-presence flags so `check()` can avoid re-scanning
        // a buffer once we've already confirmed the marker is in it. The
        // companion stdout/stderr indices on ctx are advanced incrementally
        // by check() so the worst-case scan stays O(total bytes), not
        // O(total bytes × chunks).
        let stdoutHasMarker = false;
        let stderrHasMarker = false;

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

            // Incremental marker scan. Only walk the bytes we haven't
            // already inspected; back up by marker.length - 1 first so a
            // marker straddling a chunk boundary is still detected.
            if (!stdoutHasMarker) {
                const fromIdx = Math.max(0, ctx.stdoutScanIdx - (marker.length - 1));
                const found = ctx.stdout.indexOf(marker, fromIdx);
                if (found !== -1) {
                    stdoutHasMarker = true;
                } else {
                    ctx.stdoutScanIdx = ctx.stdout.length;
                }
            }
            if (!stdoutHasMarker) return;

            if (!stderrHasMarker) {
                const fromIdx = Math.max(0, ctx.stderrScanIdx - (marker.length - 1));
                const found = ctx.stderr.indexOf(marker, fromIdx);
                if (found !== -1) {
                    stderrHasMarker = true;
                } else {
                    ctx.stderrScanIdx = ctx.stderr.length;
                }
            }
            if (!stderrHasMarker) return;

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
                // Teardown path: reject with NoSuchDriverError so callers
                // (and Appium's HTTP layer) see "session is terminating"
                // instead of an ambiguous empty success. Resolving with ''
                // here used to surface as NoSuchElementError to find* callers
                // and as silent "empty result" to others — both misleading.
                driver.log.debug('PowerShell process closed during session teardown');
                reject(new errors.NoSuchDriverError(
                    'PowerShell session terminated while command was in flight'
                ));
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

        // Write the framed command as four lines (no & { ... } wrap — see
        // below for why):
        //   1. $LASTEXITCODE = 0        - reset the native-exit slot so we
        //                                 don't pick up a stale value from
        //                                 an earlier command in the session.
        //   2. <user command>           - sent raw. If the command contains
        //                                 'using namespace', defines vars
        //                                 we need to persist (e.g.
        //                                 $cacheRequest, $elementTable),
        //                                 or relies on session-scope state,
        //                                 wrapping in & { } would break it.
        //                                 In particular, 'using namespace'
        //                                 inside & { } silently hangs the
        //                                 PS stdin parser.
        //                                 Trade-off: a malformed user
        //                                 command (open pipe, unclosed
        //                                 brace) will absorb the marker
        //                                 lines and time out. That's the
        //                                 caller's bug, surfaced as a 60s
        //                                 timeout rather than silent
        //                                 corruption.
        //   3. if ($LASTEXITCODE -ne 0) { ... } - emit "[NativeExit] N" on
        //                                 stderr when the command's last
        //                                 native exe exited non-zero, so
        //                                 check() can surface it.
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
            powerShell.stdin.write(`${command}\n`);
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

    // Depth cap: refuse new commands once the queue is saturated. Keeps the
    // commandQueue Promise chain bounded, surfaces runaway clients quickly,
    // and prevents the queue from holding gigabytes of pending command
    // bytes during graceful shutdown. The increment must happen BEFORE
    // chaining onto commandQueue so that concurrent callers see the cap
    // correctly without interleaving.
    if (this.powerShellQueueDepth >= MAX_POWERSHELL_QUEUE_DEPTH) {
        throw new errors.UnknownError(
            `PowerShell command queue is full (${this.powerShellQueueDepth} pending, cap ${MAX_POWERSHELL_QUEUE_DEPTH}). `
            + `Slow down callers or raise MAX_POWERSHELL_QUEUE_DEPTH. Rejecting this command.`
        );
    }
    this.powerShellQueueDepth++;

    if (!this.commandQueue) {
        this.commandQueue = Promise.resolve();
    }

    this.commandQueue = this.commandQueue.catch((err) => {
        this.log.debug(`[Command Queue] Previous command failed, proceeding with next command. Error: ${err?.message || err}`);
    }).then(async () => {
        try {
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

            // `??` (not `||`) so 0 / negative don't silently become the default,
            // and so we surface invalid configurations rather than masking them.
            const rawTimeout = (this.caps as any).powerShellCommandTimeout as unknown;
            const timeoutMs = (typeof rawTimeout === 'number' && Number.isFinite(rawTimeout) && rawTimeout > 0)
                ? rawTimeout
                : DEFAULT_POWERSHELL_COMMAND_TIMEOUT_MS;
            return await waitForCommandCompletion(this, this.powerShell!, command, timeoutMs);
        } finally {
            // Decrement on settle (success or failure) so the depth cap is
            // an in-flight count, not a lifetime count. Wrapped in try {}
            // to avoid leaking a stale increment if the inner await throws.
            this.powerShellQueueDepth--;
        }
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
 * Init script as one combined script. Sent as a single sendPowerShellCommand
 * call so that:
 *   - `using namespace` at the top applies to the whole script
 *   - $cacheRequest, $elementTable and other variables defined here persist
 *     to subsequent commands (each line is part of the same script-scope)
 *   - Add-Type assembly loads complete before later lines reference the
 *     short type names.
 *
 * Earlier 1.1.11 split this into stages with individual framed sends; that
 * broke `using namespace System.Windows.Automation` (which silently hung the
 * PS stdin parser when wrapped, and may not persist across REPL inputs even
 * unwrapped). Reverted to the upstream-style single-block init.
 */
const INIT_SCRIPT: string = [
    USE_UI_AUTOMATION_CLIENT, // 'using namespace ...' must come first
    SET_UTF8_ENCODING,
    ADD_NECESSARY_ASSEMBLIES,
    WIN32_HELPER_SCRIPT,
    INIT_CACHE_REQUEST,
    INIT_ELEMENT_TABLE,
    PAGE_SOURCE,
    FIND_CHILDREN_RECURSIVELY,
    FIND_DESCENDANTS_FUNCTIONS,
].join('\n');

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
            // Escape single quotes for PS single-quoted string (doubled-quote
            // is the PS literal-string escape).
            const psEscaped = expandedDir.replace(/'/g, "''");
            await sendPowerShellCommand.call(this, `Set-Location -Path '${psEscaped}'`);
        }

        // Init runs as ONE combined script so `using namespace` applies to
        // the whole block and variables persist for later commands.
        this.log.info('Initializing PowerShell environment...');
        const initStart = Date.now();
        await sendPowerShellCommand.call(this, INIT_SCRIPT);
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

    // Nothing specified at all — null root.
    if (!app && !appTopLevelWindow) {
        this.log.info('No app or appTopLevelWindow specified. Setting root element to null.');
        await sendPowerShellCommand.call(this, NULL_ROOT_ELEMENT);
        return;
    }

    // app=none explicitly disables root scoping (even if appTopLevelWindow
    // is also set, the explicit opt-out wins).
    if (app && app.toLowerCase() === 'none') {
        this.log.info('app=none specified. Setting root element to null.');
        await sendPowerShellCommand.call(this, NULL_ROOT_ELEMENT);
        return;
    }

    // Desktop root
    if (app && app.toLowerCase() === 'root') {
        this.log.info('Setting root element to desktop root.');
        await sendPowerShellCommand.call(this, INIT_ROOT_ELEMENT);
        return;
    }

    // Launch application by path / AUMID
    if (app) {
        const expandedApp = expandEnvironmentVariables(app, this.log);
        this.log.info(`Launching application: ${expandedApp}`);
        await this.changeRootElement(expandedApp);
        return;
    }

    // No app, but appTopLevelWindow is set — scope to that window handle.
    // (driver.createSession already rejects the case where BOTH app and
    // appTopLevelWindow are set, so we don't have to handle it here.)
    if (appTopLevelWindow) {
        const handle = Number(appTopLevelWindow);
        if (isNaN(handle)) {
            throw new errors.InvalidArgumentError('Invalid appTopLevelWindow: not a valid window handle');
        }
        this.log.info(`Setting root element to window handle: ${handle}`);
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
