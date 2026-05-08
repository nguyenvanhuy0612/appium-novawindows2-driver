# Error Codes

Every error class the driver throws, what triggers it, and the typical fix. All errors come from `@appium/base-driver`'s `errors` module and surface to the test client as standard W3C `WebDriverException` codes.

## Quick reference

| Error class | W3C code | Typical meaning |
|---|---|---|
| `NoSuchElementError` | `no such element` | The element couldn't be located, or its session-cache entry has been evicted |
| `NoSuchWindowError` | `no such window` | A window with that name/handle doesn't exist on the desktop |
| `InvalidArgumentError` | `invalid argument` | A capability, command argument, or selector value failed validation |
| `InvalidSelectorError` | `invalid selector` | The `-windows uiautomation` selector string couldn't be parsed |
| `InvalidElementStateError` | `invalid element state` | The element doesn't support the requested operation (e.g. ScrollIntoView on a non-scrollable element) |
| `UnknownError` | `unknown error` | A PowerShell call failed with stderr output, or a Win32 API call returned an error code |
| `UnknownCommandError` | `unknown command` | An unrecognised `windows:*` extension command was invoked |
| `NotImplementedError` | `not implemented` | An extension command path that hasn't been implemented yet |
| `TimeoutError` | `timeout` | A PowerShell command exceeded `appium:powerShellCommandTimeout` (default 60 s) |

---

## Detailed reference

### `NoSuchElementError`

Element couldn't be located — or it was located previously but the session-cache entry is gone.

| Trigger | Typical cause | Fix |
|---|---|---|
| `findElement` returned no match | XPath / DSL doesn't match the live tree | Verify against `getPageSource()`. See [Finding Elements → troubleshooting](./finding-elements.md#why-cant-i-find-this-element--troubleshooting) |
| `findElement` returned no match in ControlView | Element is filtered out — needs RawView | `windows: cacheRequest` with `RawViewCondition` |
| Pattern handler returns no element id | The element used to exist but is gone | Re-find before the action, or wrap in `WebDriverWait` |
| Click / setValue on a stale element id | Element id was cached from before a session reattach or auto-restart | Re-find. The ID returned by `findElement` is session-scoped — don't store IDs across sessions |
| `windows: setProcessForeground` with no matching window | Process is gone, or no top-level window for that PID | Verify the process is running and has a visible window |
| `appium:appTopLevelWindow` not found | HWND is bad, hex format wrong, or the window doesn't exist | Get current handles via `getWindowHandles()` |

Source sites: `lib/driver.ts:189`, `lib/commands/element.ts:42,53`, `lib/commands/extension.ts:151,161,332,428,830`.

### `NoSuchWindowError`

A window-targeting operation couldn't find its target.

| Trigger | Cause | Fix |
|---|---|---|
| `setWindow(nameOrHandle)` after 20 retries | Name typo, window not yet visible, name mismatch (localised vs literal) | Wait for the window first; verify the exact `Name` property in page source; try the HWND form |
| `title()` / `maximizeWindow()` etc. with no root | Session created with `app: 'none'` then a window-level command was called | Re-attach via `appium:appTopLevelWindow` or `changeRootElement` |

Source sites: `lib/commands/app.ts:119,313`.

### `InvalidArgumentError`

A capability, command argument, or constructor input failed validation.

#### Common scenarios

| Trigger | Specifics |
|---|---|
| Bad capability values | `appium:smoothPointerMove` not in `[linear, ease, ease-in, ease-out, ease-in-out]` and not a valid `cubic-bezier()` (`util.ts:26`) |
| Conflicting caps | `app` and `appTopLevelWindow` both set — pick one (`driver.ts:222`) |
| Bad selector for find strategy | Unknown strategy passed to `findElOrEls` (`driver.ts:174`) |
| `setWindowRect` with negative dimensions | `width` or `height` < 0 (`app.ts:380,383`) |
| `launchApp` with no `app` cap | Session was started without `app`; nothing to launch (`app.ts:367`) |
| `pushFile` payload not base64 | Falls outside `[A-Za-z0-9+/=\s]` (`file.ts:10`) — security hardening, see [code-review #4](../code-review/2026-05-08.md) |
| Bad action sequence | Missing required field on a key/pointer/wheel action (`actions.ts:36,89,108,152`) |
| `windows: cacheRequest` with empty payload | At least one of `treeFilter` / `treeScope` / `automationElementMode` required (`extension.ts:257`) |
| `windows: cacheRequest` with bad enum | Unknown `treeScope` (e.g. `"NotARealScope"`) or `automationElementMode` (`extension.ts:283,294`) |
| `windows: keys` with malformed action | Action object missing exactly one of `pause` / `text` / `virtualKeyCode` (`extension.ts:573`) |
| `windows: click` / `clickAndDrag` with one of x/y but not the other | Both must be provided together (`extension.ts:645,719,791,886,894`) |
| `windows: click` with bad button | Not in `[left, middle, right, back, forward]` (`extension.ts:902`) |
| `windows: setProcessForeground` with no `process` | Argument missing (`extension.ts:822`) |
| `windows: getClipboard` / `setClipboard` with bad `contentType` | Not `plaintext` or `image` (`extension.ts:524,541`) |
| `windows: setClipboard` with no `b64Content` | Missing field (`extension.ts:530`) |
| `windows: typeDelay` with non-numeric / negative | Must be a non-negative number (`extension.ts:851,855`) |
| `windows: setFocus` / pattern handlers with no element | Element ref missing or malformed (`extension.ts:238,347,837`) |
| `executePowerShellScript` with no script | Either `script` or `command` field required (`extension.ts:552`) |
| Bad keyboard event | Both `vk` and `scan` set, or `scan` not single char (`user32.ts:324,330`) |
| Bad mouse button | Not in 0–4 (`user32.ts:397,425`) |
| `mouseMoveAbsolute` without resolution | Internal — caller didn't resolve screen size first (`user32.ts:469`) |
| Bad keyboard input character | Charcode outside the supported range (`user32.ts:628`) |
| `PSObject` constructor type mismatch | Wrong JS type passed to one of `PSString` / `PSBoolean` / `PSInt32` / `PSInt32Array` / `PSPoint` / `PSRect` / `PSCultureInfo` etc. (`common.ts:24,33,42,54,67,78,99,110,120,132`) |
| `Condition` constructor type mismatch | `AndCondition` / `OrCondition` with < 2 conditions, or non-Condition argument; `NotCondition` with non-Condition (`conditions.ts:118,122,132,136,146,167`) |
| `$()` / `DeferredStringTemplate` index validation | Negative or non-integer template index (`util.ts:47,64`) |

#### Fix patterns

- **For capability errors**: validate caps client-side before `createSession`. The full constraints map is in `lib/constraints.ts`.
- **For argument errors**: read the message — it almost always names the missing/wrong field.
- **For type mismatches in the PS DSL**: you're constructing a `PSObject` / `Condition` directly (rare from test code; common when extending the driver). Match the constructor signature shown in [API inventory](../architecture/api-inventory.md).

### `InvalidSelectorError`

The `-windows uiautomation` selector couldn't be parsed.

| Trigger | Cause | Fix |
|---|---|---|
| `Could not parse Windows Automation selector expression '...'` | Syntax error in the DSL | See [Finding Elements → DSL syntax](./finding-elements.md#the--windows-uiautomation-selector-dsl) |
| `Selector contains restricted characters in the Unicode Private Use Area (-)` | Selector includes characters from the parser's internal magic-placeholder range. Don't use ``–`` in user input | Strip those characters before passing the selector |

Source: `lib/powershell/converter.ts:99,316`.

### `InvalidElementStateError`

The element doesn't support the requested operation.

| Trigger | Cause | Fix |
|---|---|---|
| `runPatternCommand` saw "Unsupported Pattern" from PS | Element doesn't expose the pattern (e.g. `WindowPattern` on a non-window) | Check pattern availability via `getProperty('all')` and JSON-parse the `availablePatterns` field |

Source: `lib/commands/extension.ts:324`.

### `UnknownError`

Catch-all for failures from the PowerShell or Win32 layer.

| Trigger | Cause | Fix |
|---|---|---|
| `PowerShell session is not available or closed` | PS process exited and auto-restart hasn't kicked in yet (or failed) | Should self-heal. If persistent, check the appium log for the actual exit cause |
| `Failed to write to PowerShell: ...` | EPIPE on `stdin.write` — PS process died mid-write | Auto-restart will kick in for the next command. See [PowerShell session](../architecture/powershell-session.md#failure-modes-real-incidents) |
| `[PowerShell Error] Exited with code N (0xHEX). stderr: ...` | PS process exited unexpectedly | Stderr is included. Common case: code 5 (`ACCESS_DENIED`) after Shell.Application.Quit + Invoke-Item — see [PS session #2](../architecture/powershell-session.md#shell-application-quit-+-invoke-item-+-uia-query-cascade---fixed-by-auto-restart) |
| Stderr from any in-session PS command | Script wrote to stderr or threw | The thrown message is included verbatim. Decode the original PS via `decodePwsh` for debugging |
| `Failed to locate top level window with that window handle` | `appTopLevelWindow` HWND doesn't match any window | Get current handles via `getWindowHandles()` |
| `Failed to locate window of the app` | `attachToApplicationWindow` exhausted retries — app didn't spawn a visible window in time | Bump `ms:waitForAppLaunch`, or check the app actually launches manually |
| `Failed to maximize/minimize the window` | The `WindowPattern` call returned an error | Check the window supports `WindowPattern` (most do, but custom dialogs sometimes don't) |
| `Failed to set value on element. ValuePattern error: ... RangeValuePattern fallback error: ...` | Both patterns rejected the value | Element doesn't support either pattern — try `windows: keys` with explicit text input |
| `An error occurred while executing SendInput` | Win32 `SendInput` returned 0 | Usually means UIPI / blocked input. Run Appium with sufficient privileges |
| `An error occurred while trying to set DPI awareness` | `SetProcessDPIAware` failed | Process already had DPI awareness set, or denied — usually harmless |

Source sites: `lib/commands/powershell.ts:64,153,187`, `lib/commands/app.ts:136,190,199,302,330,339`, `lib/commands/extension.ts:475`, `lib/winapi/user32.ts:740,818`.

### `UnknownCommandError`

Unknown `windows:*` extension command.

| Trigger | Cause | Fix |
|---|---|---|
| `Unknown command 'windows: <name>'` | Typo in the script string, or running against an old driver version that doesn't have the command | Check the command spelling against [Extensions](./extensions.md). Verify driver version with `appium driver list --installed` |

Source: `lib/commands/extension.ts:204`.

### `NotImplementedError`

A code path reachable but not yet implemented.

| Trigger | Notes |
|---|---|
| `execute()` fell through to the default case | Internal — would mean an unmapped command type. Should not be hit in normal use |

Source: `lib/commands/extension.ts:243`.

### `TimeoutError`

A PowerShell command took longer than `appium:powerShellCommandTimeout`.

| Trigger | Cause | Fix |
|---|---|---|
| `PowerShell command timed out after Nms` | The command (often a tree walk) is genuinely slow, or PS is hung | Bump `appium:powerShellCommandTimeout` (default 60 000 ms). If it persists, the PS process is killed via `taskkill /F /T`; auto-restart spins up a new session for the next command |

Source: `lib/commands/powershell.ts:112`.

---

## Reading driver-side error logs

When a command fails on the driver, the appium server log includes:

- The originating HTTP request (so you know which test step it was)
- The error name + stack trace
- For PS errors, the decoded original PS command (via `decodePwsh`) — base64-wrapping is reversed for readability
- The PS stderr buffer contents

Pull via [`scripts/local/copy_log.ps1`](../../scripts/local/copy_log.ps1):

```powershell
.\scripts\local\copy_log.ps1 -RemoteHost <vm> -Tail 100
```

For live debugging, `-Follow` streams the log:

```powershell
.\scripts\local\copy_log.ps1 -RemoteHost <vm> -Follow
```

## See also

- [Finding Elements → troubleshooting](./finding-elements.md#why-cant-i-find-this-element--troubleshooting) — `NoSuchElementError` decision tree
- [PowerShell session → failure modes](../architecture/powershell-session.md#failure-modes-real-incidents) — how the session handles UIA crashes
- [Capabilities](./capabilities.md) — every capability and its validation rules
- [Code review tracker](../code-review/2026-05-08.md) — known issues and fix history
