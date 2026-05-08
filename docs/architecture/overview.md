# Architecture Overview

How the driver's pieces fit together, and the rationale behind the major design choices.

## Three layers

```
┌──────────────────────────────────────────────────────────────────┐
│  Layer 1 — Node.js / TypeScript (in-process with Appium)         │
│                                                                  │
│    NovaWindows2Driver (extends BaseDriver)                       │
│      ├─ commands/      W3C + windows:* command handlers          │
│      ├─ powershell/    DSL — generates PS scripts as strings     │
│      ├─ xpath/         XPath 1.0 → UIA Condition tree            │
│      └─ winapi/        koffi FFI to user32 / kernel32 / psapi    │
└──────────────────────────────────────────────────────────────────┘
                          │  base64-wrapped Invoke-Expression
                          ▼  via stdin / stdout
┌──────────────────────────────────────────────────────────────────┐
│  Layer 2 — PowerShell (one persistent child process per session) │
│                                                                  │
│    System.Windows.Automation (UIA)                               │
│      ├─ $rootElement, $elementTable, $cacheRequest               │
│      ├─ Find-* helper functions                                  │
│      └─ Win32Helper.dll (compiled from embedded C# at startup)   │
└──────────────────────────────────────────────────────────────────┘
                          │  UIA / MSAA / P/Invoke
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│  Layer 3 — Target Windows application                            │
│    UWP / WPF / WinForms / Win32 / mixed                          │
└──────────────────────────────────────────────────────────────────┘
```

Why three layers and not two? Because the alternatives are worse:

- **Pure Node + N-API addon for UIA** — would mean writing a native module that wraps `IUIAutomation`. Cross-arch builds (x64 + ARM64) become harder, install becomes node-gyp territory, and any UIA quirks land in your codebase. The PowerShell wrapper hides UIA's complexity behind text-based stdin/stdout.
- **Pure PowerShell driver** — Appium speaks WebDriver/JSON, so something has to translate. Putting everything in PowerShell would mean implementing the W3C protocol there, which would be a maintenance nightmare and would block running on non-Windows control hosts.
- **One PS process per command** — would solve some isolation concerns but the spawn cost dominates: ~500 ms per command on Windows. The persistent session amortises that to ~10 ms per command after the first.

## Driver class

[`lib/driver.ts`](../../lib/driver.ts) hosts `NovaWindows2Driver`, which extends Appium's `BaseDriver`. Its responsibilities:

- Session lifecycle (`createSession`, `deleteSession`)
- Command dispatch — every method call from Appium's HTTP server lands as a method on this class
- Owning the persistent PowerShell child process
- Routing locator strategies to the right finder

All command handlers (in `lib/commands/*.ts`) are bound to the instance in the constructor — see `lib/commands/index.ts`. This means `this` inside a command always refers to the driver instance with all its session-scoped state (PS process, command queue, modifier-key state, capability cache, etc.).

## Per-instance state isolation

Several fields live on the **instance**, not the prototype, so concurrent Appium sessions don't share them:

| Field | What it holds |
|---|---|
| `powerShell?: ChildProcessWithoutNullStreams` | The PS child process for this session |
| `powerShellStdOut: string` | Accumulator for output of the in-flight command |
| `powerShellStdErr: string` | Accumulator for stderr of the in-flight command |
| `commandQueue: Promise<any>` | Serialises PS I/O — chained `.then()` per command |
| `powerShellRestartPromise?: Promise<void>` | Dedupes concurrent auto-restart attempts (1.1.9+) |
| `keyboardState: KeyboardState` | Tracks held modifiers and pressed keys |

Run 4 sessions in parallel against 4 hosts and each session is fully isolated.

## Command queue

`commandQueue` is a chained Promise that serialises PowerShell I/O for the session. Every `sendPowerShellCommand` call appends a `.then(...)` link:

```ts
this.commandQueue = this.commandQueue.catch(swallowError).then(async () => {
    ensureSessionReady(this);
    this.powerShell!.stdin.write(`${command}\n`);
    this.powerShell!.stdin.write(`Write-Output "${COMMAND_END_MARKER}"\n`);
    return waitForCommandCompletion(this, this.powerShell!, timeoutMs, command);
});
return this.commandQueue;
```

Why serialise? Because PowerShell stdin is one bidirectional stream — interleaving commands would corrupt the output buffer. The queue means a test issuing concurrent calls (`await Promise.all([driver.click(a), driver.click(b)])`) doesn't race the underlying process; the driver completes them one at a time.

The `COMMAND_END_MARKER` (`___NOVA_WIN2_DRIVER_END___`) is a sentinel string emitted after every command. The Node side tails stdout looking for it — that's how it knows the command is done. Required because PowerShell's persistent session doesn't have a natural per-command boundary.

See [PowerShell session](./powershell-session.md) for the full lifecycle.

## Element representation

Elements are kept in a PowerShell-side hashtable, not serialised across the boundary every time:

1. A find call (e.g. `findElement('xpath', '//Button')`) runs in PS, gets a `[AutomationElement]`, computes its `RuntimeId` (a dot-separated integer string like `"42.131954"`), and stashes the element in `$elementTable[$runtimeId] = $el`.
2. PS prints the runtime id back as the result.
3. Node wraps it in a W3C element ref `{ "element-6066-11e4-a52e-4f735466cecf": "42.131954" }` and returns it to the caller.
4. Subsequent commands on this element (click, getProperty, etc.) look up the element back in `$elementTable[$runtimeId]` — no re-traversal of the UIA tree.

This is what makes a sequence like `el.click(); el.text;` fast — both calls are single hash lookups, not tree walks.

The element table is **session-scoped**: it does not survive a PS-session restart. After auto-restart, stale element ids surface as `NoSuchElementError` (correct behaviour — the underlying UIA elements may have been destroyed by whatever killed the session).

## End-to-end request flows

### Find element flow

```
Test code
    │  driver.find_element('xpath', "//Button[@Name='OK']")
    ▼
Appium HTTP layer
    │
    ▼
NovaWindows2Driver.findElement('xpath', "//Button[@Name='OK']")
    │
    ▼
processSelector('xpath', selector)               normalises/rewrites if needed
    │
    ▼
findElOrEls(strategy='xpath', ...)               dispatches by strategy
    │
    ▼
xpath/core.xpathToElIdOrIds(selector, ...)       parses the XPath
    │
    ▼
XPathExecutor.executeStep(step, context)         per-step traversal
    │   builds AutomationElement query:
    │     $rootElement.FindFirst(
    │       [TreeScope]::Descendants,
    │       [PropertyCondition]::new(
    │         [AutomationElement]::ControlTypeProperty,
    │         [ControlType]::Button))
    │   then chains a Where-Object filter for @Name='OK'
    │
    ▼
core.pwsh(...)                                    base64-wraps as Invoke-Expression
    │
    ▼
sendPowerShellCommand(cmd)                        queues + writes to PS stdin
    │
    ▼
PS executes
    │   $el = $rootElement.FindFirst(...)
    │   if ($el -ne $null -and $el.Current.Name -eq 'OK') {
    │     $rid = ($el.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty)) -join '.'
    │     $elementTable[$rid] = $el
    │     Write-Output $rid
    │   }
    │   Write-Output "___NOVA_WIN2_DRIVER_END___"
    │
    ▼
waitForCommandCompletion()                        sees END marker
    │
    ▼
returns "42.131954" (RuntimeId)
    │
    ▼
NovaWindows2Driver wraps as {ELEMENT: "42.131954"}
    │
    ▼
Test code sees a WebDriver element
```

### Click flow

```
Test code  →  element.click()
              ▼
        NovaWindows2Driver.click(elementId)
              ▼
        find clickable point: element.GetClickablePoint() in PS
              │  (falls back to element bounding-rect center)
              ▼
        bring ancestor window to foreground:
          BRING_ELEMENT_TO_FRONT (uses Win32Helper.dll inside PS session)
              ▼
        scroll into view:
          ScrollItemPattern → SetFocus → keyboard PageDown fallback
              ▼
        winapi/user32.mouseMoveAbsolute(x, y, duration, easing)
              │  optional bezier easing animation via setTimeout loop
              ▼
        winapi/user32.mouseDown(button) + mouseUp(button)
              ▼
        sleep(delayAfterClick)
```

### Property read flow

```
driver.get_property(element, 'Toggle.ToggleState')
        ▼
  NovaWindows2Driver.getProperty('Toggle.ToggleState', elementId)
        ▼
  Resolution chain (in order):
    1. Legacy alias?    'LegacyName'/'LegacyValue'/...    (no — has dot)
    2. Legacy.Prop?     'LegacyIAccessible.X'             (no — different prefix)
    3. Pattern.Prop?    'Toggle.ToggleState'              ← matches
        ▼
  AutomationElement.buildGetPatternPropertyCommand('Toggle', 'ToggleState')
        ▼
  $elementTable[$rid].GetCurrentPattern([TogglePattern]::Pattern).Current.ToggleState
        ▼
  sendPowerShellCommand → PS evaluates → "On"
        ▼
  returns "On" to caller
```

For a Win32/MSAA proxy element where `getCurrentPattern` returns null, the resolver falls through to `Get-LegacyPropertySafe` which probes UIA → MSAA-by-Point → MSAA-by-HWND.

### Session lifecycle

```
createSession(caps)
    ▼
  startPowerShellSession()
    ├─ spawn powershell.exe -NoProfile -NoExit -Command -
    ├─ pin UTF-8 on stdout/stderr
    ├─ register stdin/exit error handlers (prevents EPIPE crashes)
    ├─ load .NET assemblies (UIAutomationClient, System.Drawing, ...)
    ├─ compile + load Win32Helper.dll
    ├─ define helper PS functions (Find-*, Get-LegacyPropertySafe, Get-PageSource, ...)
    ├─ initialise $cacheRequest, $elementTable, $rootElement
    └─ run setupRootElement() based on caps.app
    ▼
  run caps.prerun (if set)
    ▼
  session is live — commands serialised through commandQueue
    ▼
  ... test runs ...
    ▼
deleteSession()
    ▼
  closeApp() (if shouldCloseApp)
    ▼
  run caps.postrun (if set)
    ▼
  terminatePowerShellSession()
    ├─ end stdin (graceful exit signal)
    └─ 5-second timeout → SIGKILL if PS doesn't close
```

If the PS process dies mid-session (UIA crash, killed by user script, OOM), the next `sendPowerShellCommand` triggers auto-restart through `ensurePowerShellSession`. See [PowerShell session](./powershell-session.md#auto-restart).

## Where to next

| Topic | Page |
|---|---|
| Per-module breakdown of `lib/` | [Components](./components.md) |
| The persistent PS process — spawn, queue, auto-restart, failure modes | [PowerShell session](./powershell-session.md) |
| Function-by-function inventory | [API inventory](./api-inventory.md) |
| Locator strategies + XPath | [Finding Elements](../reference/finding-elements.md) |
| Capabilities | [Capabilities](../reference/capabilities.md) |
