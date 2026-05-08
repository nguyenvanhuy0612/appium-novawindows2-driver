# The Persistent PowerShell Session

The driver's most subtle piece. One PowerShell child process per Appium session, owned by the driver instance, drives every UIA / MSAA / Win32 operation. This page walks through how it's spawned, how commands flow through it, and how the driver recovers when the OS or the user's test code knocks it over.

All code references point into [`lib/commands/powershell.ts`](../../lib/commands/powershell.ts).

## Why persistent

The alternative is one fresh `powershell.exe` per command. Cost on Windows is ~500 ms — dominated by .NET assembly load. With a persistent session the cost drops to ~10 ms per command after the initial setup.

Persistence also lets us keep state in PS variables. Three matter:

| PS variable | Purpose |
|---|---|
| `$rootElement` | The `[AutomationElement]` that find-element starts from. Set by `setupRootElement` based on caps. Survives restart. |
| `$elementTable` | `Dictionary<string, AutomationElement>` mapping `RuntimeId` → cached element. **Cleared on restart.** |
| `$cacheRequest` | Active UIA `CacheRequest` (treeFilter / treeScope / mode). Survives restart. |

The session also carries pre-defined helper functions (`Find-ChildrenRecursively`, `Find-Descendant`, `Get-PageSource`, `Get-LegacyPropertySafe`, etc.) and the compiled `Win32Helper` C# class. These are all re-loaded by the spawn flow.

## Spawn flow — `startPowerShellSession`

Runs once per session, called from `createSession` in `lib/driver.ts`. The full sequence:

```
1. spawn powershell.exe -NoProfile -NoExit -Command -
   ├─ -NoProfile         skip user $PROFILE (avoids surprises from custom prompts/encoding)
   ├─ -NoExit            keep the process alive after each command
   └─ -Command -         read commands from stdin
   
2. setEncoding('utf8') on both stdout and stderr (Node side)
   buffers populate driver.powerShellStdOut / Err

3. register stdin('error') and process('exit') handlers
   - prevents an unhandled EPIPE event from crashing Node
   - lets ensurePowerShellSession detect a dead session before the next command

4. set $OutputEncoding + [Console]::OutputEncoding to UTF-8 (PS side)
   so the bytes Node sees match what PS thinks it's writing

5. Add-Type -AssemblyName UIAutomationClient (+ System.Drawing, PresentationCore, System.Windows.Forms)
   loads UIA, screenshot, point/rect, and clipboard support

6. Compile + load Win32Helper from embedded C# (WIN32_HELPER_SCRIPT)
   single Add-Type call — gives us BringToForeground, GetLegacyPropertyWithFallback, etc.

7. Define helper PS functions
   Find-ChildrenRecursively, Find-AllChildrenRecursively, Find-Descendant,
   Find-AllDescendants, Get-LegacyPropertySafe, Get-PageSource

8. Initialise $cacheRequest (default: ControlView), $elementTable (empty Dictionary)

9. setupRootElement() based on caps.app:
   - 'root' or unset            → $rootElement = [AutomationElement]::RootElement
   - 'none'                     → $rootElement = $null  (session with no app)
   - HWND (number)              → attach via PropertyCondition(NATIVE_WINDOW_HANDLE)
   - exe path / UWP AUMID       → launchApp() then attachToApplicationWindow()
```

Steps 4–8 are sent as a single concatenated PS script (the `combinedScript` variable in `startPowerShellSession`) for one round-trip — typically takes 1–2 seconds total on first session.

## Command flow — `sendPowerShellCommand`

Every PS command flows through this. The control flow:

```ts
async function sendPowerShellCommand(command: string): Promise<string> {
    // 1. Pre-queue: if PS is dead, restart it BEFORE adding to the queue.
    //    Cannot restart inside the queue — startPowerShellSession itself
    //    awaits sendPowerShellCommand for init, which would deadlock.
    await ensurePowerShellSession(this);
    
    // 2. Append a serialised .then() to the command queue.
    this.commandQueue = this.commandQueue.catch(swallowError).then(async () => {
        if (!isPowerShellAlive(this)) {
            await ensurePowerShellSession(this);   // double-check inside the queue
        }
        ensureSessionReady(this);                  // throws UnknownError if still dead
        
        this.powerShellStdOut = '';
        this.powerShellStdErr = '';
        
        // 3. Write the command, then a sentinel marker, then await completion.
        const writeError = await writePromise(`${command}\n`);
        if (writeError) throw new UnknownError(...);
        this.powerShell!.stdin.write(`Write-Output "${COMMAND_END_MARKER}"\n`);
        
        return waitForCommandCompletion(this, this.powerShell!, timeoutMs, command);
    });
    return this.commandQueue;
}
```

Three things to notice:

- **`COMMAND_END_MARKER`** (`___NOVA_WIN2_DRIVER_END___`) is an ASCII sentinel. The Node side accumulates stdout into `powerShellStdOut` and looks for the marker on every chunk to know the command finished. PowerShell doesn't have a natural per-command boundary in a `-NoExit` session, so we synthesise one.
- **`commandQueue` chains**. Each `sendPowerShellCommand` call appends a new `.then()` link to the chain. The chain serialises stdin writes — without it, two concurrent calls would interleave bytes on the same stream and corrupt both commands.
- **Pre-queue + in-queue health check**. The auto-restart helper is called twice: once before queuing (so a dead session is restarted before this command's `.then` even runs) and once inside the `.then` (in case a previously-queued command killed PS between our pre-check and our turn).

## Output capture — `waitForCommandCompletion`

Per-command stdout is captured by reading `powerShellStdOut` until it contains `COMMAND_END_MARKER`:

```ts
const onData = (chunk: any) => {
    if (chunk.toString().includes(COMMAND_END_MARKER)) {
        cleanup();
        if (driver.powerShellStdErr) {
            // PS wrote to stderr — usually a thrown exception in the script.
            // Log at debug, throw UnknownError to caller.
            reject(new UnknownError(driver.powerShellStdErr));
        } else {
            const result = driver.powerShellStdOut.replace(COMMAND_END_MARKER, '').trim();
            resolve(result);
        }
    }
};
```

A timeout (default 60 000 ms, capped via `appium:powerShellCommandTimeout`) starts on each command. If it fires, `killProcessTree` runs `taskkill /F /T /PID <pid>` to nuke the PS process and any descendants — UIA hangs sometimes leak child processes that won't die from a normal SIGTERM.

After a timeout-kill, `driver.powerShell = undefined` and the next `sendPowerShellCommand` triggers auto-restart.

A `process.on('close')` handler also fires `onClose(code)` if PS exits before the marker arrives — typically a fatal UIA error or someone external killing the process. The `code` propagates as part of the rejected error so the caller knows what happened.

## Auto-restart — `ensurePowerShellSession`

Added in 1.1.9. The whole point: when PS dies mid-session, the next command transparently spins up a new session and runs against it instead of returning `"PowerShell session is not available or closed"` for every subsequent call.

```ts
async function ensurePowerShellSession(driver: NovaWindows2Driver): Promise<void> {
    if (isPowerShellAlive(driver)) return;
    
    // Concurrent callers all await the same in-flight restart promise — exactly
    // one restart triggers per death, no matter how many commands are queued behind it.
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

function isPowerShellAlive(driver: NovaWindows2Driver): boolean {
    const ps = driver.powerShell;
    return !!ps && ps.exitCode === null && ps.stdin.writable;
}
```

The `powerShellRestartPromise` field lives on the driver instance — see [Components → driver class](./components.md#libdriverts--driver-class). It gates concurrent restart attempts.

The restart re-runs `startPowerShellSession` end-to-end — the whole spawn flow above. Cost: ~1–2 seconds on the first command after death, then back to normal.

### What survives a restart

| State | Survives restart? | Why |
|---|---|---|
| `$rootElement` | ✅ via re-attach | `setupRootElement` runs again from `caps.app` |
| `$cacheRequest` | ✅ via reset to default | Reset to ControlView default. Custom `windows: cacheRequest` settings don't survive |
| Helper PS functions | ✅ | Re-defined in step 7 |
| `Win32Helper` class | ✅ | Re-compiled in step 6 |
| Modifier-key state | ✅ | Lives on the driver instance, not in PS |
| `$elementTable` | ❌ | Cleared. Stale element ids surface as `NoSuchElementError` on next access |
| `caps.prerun` side effects | ❌ | Prerun is **not** re-run after a restart (it would repeat side effects — e.g. delete files, kill processes). Re-establish prerun-based state manually if needed |

The cleared element table is correct behaviour: the underlying UIA elements may have been destroyed by whatever killed PS in the first place. Returning them after restart would be a use-after-free.

## Termination — `terminatePowerShellSession`

Called by `deleteSession`. Three-step graceful shutdown:

```ts
return new Promise((resolve) => {
    const timeout = setTimeout(() => {
        // 5-second deadline reached — force kill
        powerShell.kill('SIGKILL');
        resolve();
    }, 5000);
    
    powerShell.once('close', () => {
        clearTimeout(timeout);
        resolve();
    });
    
    try {
        powerShell.stdin.end();   // close stdin → PS sees EOF and exits
    } catch {
        // already closed or broken pipe — let the timeout / close fire
    }
});
```

If PS is hung on a UIA call, `stdin.end()` won't reach it — the timeout + SIGKILL is the safety net.

## Isolated execution — `sendIsolatedPowerShellCommand`

For scripts the caller doesn't want polluting the persistent session — typically anything that touches `Shell.Application` or kills `explorer.exe`. Spawned with `appium:isolatedScriptExecution: true`:

```ts
const powerShell = spawn('powershell.exe', ['-NoProfile', '-Command', command]);
powerShell.on('close', (code) => {
    if (code === 0) resolve(stdout.trim());
    else reject(new UnknownError(`PowerShell exited with code ${exitCode}`));
});
```

One-shot subprocess. ~500 ms per call so use sparingly. The persistent session is unaffected if the isolated script crashes.

## Failure modes (real incidents)

These are documented because they've all hit production once.

### EPIPE on stdin write — fixed in 1.1.9

**Trigger**: PS process dies mid-session, then the driver's command queue writes to its stdin.

**Old behaviour** (pre-1.1.9): the `'error'` event on `stdin` had no listener. Node's default behaviour for unhandled stream errors is to crash the process. Whole Appium server went down.

**Fix**: register a stdin-error handler in `startPowerShellSession`:

```ts
powerShell.stdin.on('error', (err: any) => {
    driver.log.warn(`PowerShell stdin error (${err.code}): ${err.message}`);
    if (driver.powerShell === powerShell) {
        driver.powerShell = undefined;
    }
});
powerShell.on('exit', (code, signal) => {
    if (driver.powerShell === powerShell) {
        driver.log.warn(`PowerShell exited unexpectedly (code=${code}, signal=${signal})`);
        driver.powerShell = undefined;
    }
});
```

Now an EPIPE just nullifies `driver.powerShell`. The next `sendPowerShellCommand` sees `isPowerShellAlive() === false` and auto-restarts.

### `Shell.Application.Quit() + Invoke-Item + UIA query` cascade — fixed by auto-restart

**Reported scenario**:

```powershell
# Test code does:
(New-Object -ComObject Shell.Application).Windows() | ForEach-Object { $_.Quit() }
Invoke-Item "C:\TestFolder"
# Then driver does:
findElements xpath="//Window[@ClassName='CabinetWClass']"
# → PS process exits with code 5 (ACCESS_DENIED)
```

The `Quit()` orphans COM proxies that the persistent session was holding. The next UIA tree walk hits one of those orphans and raises a fatal exception that takes the whole PS process down with `code=5`.

**Pre-1.1.9 behaviour**: every subsequent driver command, including teardown, returned `PowerShell session is not available or closed`. The whole test suite cascade-failed.

**Post-1.1.9 behaviour**: the next command auto-restarts, the test continues. Stale element ids from before the death surface as `NoSuchElementError` — correct, because the UIA elements are actually gone.

**Best practice**: scripts that quit explorer windows or otherwise destabilise UIA should run with `appium:isolatedScriptExecution: true` so they take down only their own subprocess, not the persistent session.

### EBUSY on `koffi.node` during deploy

**Symptom** (from a `appium driver install` log):

```
npm error code EBUSY
npm error syscall copyfile
npm error path C:\Users\admin\.appium\node_modules\appium-novawindows-driver\node_modules\koffi\build\koffi\win32_x64\koffi.node
```

A still-running Node process holds `koffi.node` open. npm can't update the dependency tree mid-install.

**Fix**: kill all `node.exe` processes before installing:

```powershell
taskkill /f /im node.exe /t
```

The deploy script's stop-Appium step does this, but a manual install bypassing the script needs it too.

### Driver fails to load with `Cannot find module 'asyncbox'` — fixed in 1.1.10

**Trigger**: `appium driver install --source=npm appium-novawindows2-driver` on a fresh VM with the 1.1.9 manifest.

**Cause**: `asyncbox` and `teen_process` were imported eagerly at the top of `lib/commands/screen-recorder.ts` but not declared in `package.json`. The dev tree had them transitively; a fresh install didn't.

**Fix**: moved both packages to `optionalDependencies` and made `screen-recorder.ts` lazy-`require()` them inside the recording functions. Driver loads on hosts without the recording stack; only `windows: startRecordingScreen` fails (with an actionable error) if the deps are missing.

This is also the design pattern for any future native-binary-bearing dep — keep the recording stack fully optional, lazy-load.

### Driver loads but every command fails — caused by `--source=local` install without `npm install`

**Trigger**: `appium driver install --source=local <unpacked-tarball-dir>` registers the path with Appium but does NOT run `npm install` for the package's deps. If you didn't run `npm install --omit=dev` inside the unpacked dir first, the loaded driver has no `node_modules`.

**Fix**: the deploy script's [step 6](../development/deploy.md#6-npm-install---omitdev) was added precisely for this — runs `npm install --omit=dev` before the `--source=local` registration. If you're installing manually outside the script, do it yourself:

```powershell
cd C:/temp/unpacked-tarball
npm install --omit=dev
appium driver install --source=local C:/temp/unpacked-tarball
```

## See also

- [Architecture overview](./overview.md) — how the PS session fits with the rest
- [Components](./components.md) — `lib/commands/powershell.ts` summary in context
- [Capabilities](../reference/capabilities.md) — `appium:powerShellCommandTimeout`, `isolatedScriptExecution`, `prerun`/`postrun`
- [Deploy](../development/deploy.md) — installing the driver, troubleshooting EBUSY / install failures
- [Code review tracker](../code-review/2026-05-08.md) — finding #21 (auto-restart) and #22 (asyncbox/teen_process optional)
