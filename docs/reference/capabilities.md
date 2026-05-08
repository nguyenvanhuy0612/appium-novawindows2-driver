# Capabilities

All capabilities use the `appium:` prefix when specified via the W3C protocol.

## Required Capabilities

| Capability | Type | Description |
|---|---|---|
| `platformName` | `string` | Must be `"Windows"` (case-insensitive) |
| `appium:automationName` | `string` | Must be `"NovaWindows2"` |

## Application Capabilities

| Capability | Type | Default | Description |
|---|---|---|---|
| `appium:app` | `string` | — | Path to the application executable (classic: `C:\path\to\app.exe`) or UWP app ID (format: `Something!App_something_random`). Use `"root"` to target the whole desktop. Use `"none"` or omit to not launch any app. |
| `appium:appTopLevelWindow` | `string` | — | Native window handle (in hex, e.g. `"0x00010ABC"`) of an already-running window to attach to. Cannot be combined with `appium:app`. |
| `appium:appArguments` | `string` | — | Command-line arguments passed to the app on launch. |
| `appium:appWorkingDir` | `string` | — | Working directory for the app process. Supports `%ENV_VAR%` expansion. |
| `appium:shouldCloseApp` | `boolean` | `true` | Whether to close the application when the session ends. |
| `ms:waitForAppLaunch` | `number` | `0` | Seconds to wait after the app launch command before trying to locate the main window. |
| `ms:forcequit` | `boolean` | `false` | When `true`, forcefully kills the app process (`Stop-Process -Force`) instead of using the UIA Close pattern on session end. |

## Session Lifecycle Capabilities

| Capability | Type | Default | Description |
|---|---|---|---|
| `appium:prerun` | `object` | — | A PowerShell script to execute **before** the session is fully established. Accepts `{ script: "..." }` or `{ command: "..." }`. |
| `appium:postrun` | `object` | — | A PowerShell script to execute **after** the session ends (before terminating PowerShell). Same format as `prerun`. |

**Example:**
```json
{
  "appium:prerun": { "script": "Write-Output 'Session starting'" },
  "appium:postrun": { "command": "Stop-Process -Name 'notepad' -ErrorAction SilentlyContinue" }
}
```

## Interaction Capabilities

| Capability | Type | Default | Description |
|---|---|---|---|
| `appium:smoothPointerMove` | `string` | — | Easing function for smooth mouse movement. Supported values: `"linear"`, `"ease"`, `"ease-in"`, `"ease-out"`, `"ease-in-out"`. When not set, mouse jumps instantly. |
| `appium:delayBeforeClick` | `number` | `0` | Milliseconds to wait (as part of mouse movement) before performing a `click`. |
| `appium:delayAfterClick` | `number` | `0` | Milliseconds to sleep after performing a `click`. |
| `appium:typeDelay` | `number` | `0` | Milliseconds to wait between each character when typing via `setValue`. |
| `appium:releaseModifierKeys` | `boolean` | `true` | Whether modifier keys (Shift, Ctrl, Alt, Meta) held down during `setValue` are automatically released at the end. |

## XPath & Search Capabilities

| Capability | Type | Default | Description |
|---|---|---|---|
| `appium:convertAbsoluteXPathToRelativeFromElement` | `boolean` | `true` | When finding elements *from* an element context, absolute XPath selectors starting with `/` are automatically prefixed with `.` to make them relative. |
| `appium:includeContextElementInSearch` | `boolean` | `true` | Whether to include the context element itself in XPath searches when searching from an element. |

## PowerShell Capabilities

| Capability | Type | Default | Description |
|---|---|---|---|
| `appium:powerShellCommandTimeout` | `number` | `60000` | Timeout in milliseconds for a single PowerShell command to complete before the session is terminated. |
| `appium:isolatedScriptExecution` | `boolean` | `false` | When `true`, `execute('powershell', ...)` runs each script in a **fresh, isolated** PowerShell process instead of the shared session. Useful for scripts that modify global state. |

## Capability interactions

A few caps interact in non-obvious ways:

| If you set… | Then… |
|---|---|
| `appium:app` and `appium:appTopLevelWindow` | `InvalidArgumentError` — pick one. Use `app` to launch a new instance, `appTopLevelWindow` to attach to an existing window |
| `appium:smoothPointerMove` without `appium:delayBeforeClick` | The easing is applied over 0 ms — effectively instant. Set `delayBeforeClick` to give the easing time to play out (200–500 ms typical) |
| `ms:waitForAppLaunch` on a fast-launching app | No harm — it's a max wait, not a fixed sleep |
| `ms:forcequit: true` and `appium:shouldCloseApp: false` | `forcequit` is gated by `shouldCloseApp` — both must be set to actually force-quit |
| `appium:isolatedScriptExecution: true` and `appium:prerun` | `prerun` still runs in the persistent session. Only `execute('powershell', ...)` calls go isolated |

## Validation rules

Caps are validated by `lib/constraints.ts` at session creation. Most surface as `InvalidArgumentError`:

| Cap | Validation |
|---|---|
| `appium:smoothPointerMove` | Must be one of `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, OR a valid `cubic-bezier(x1,y1,x2,y2)` string |
| `appium:powerShellCommandTimeout` | Must be a positive number; defaults to 60 000 ms |
| `appium:typeDelay` / `appium:delayBeforeClick` / `appium:delayAfterClick` | Non-negative numbers |

See [Error codes → InvalidArgumentError](./error-codes.md#invalidargumenterror) for the full list of cap-validation triggers.

## Enterprise capability presets

Common scenarios. Combine + adjust to taste.

### Legacy WinForms / Win32 app on a slow VM

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:app": "C:\\Program Files\\LegacyApp\\App.exe",
  "appium:shouldCloseApp": true,
  "ms:waitForAppLaunch": 10,
  "ms:forcequit": true,
  "appium:powerShellCommandTimeout": 120000,
  "appium:typeDelay": 30,
  "appium:releaseModifierKeys": true
}
```

### WPF / WinForms desktop with deep XPath

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:app": "C:\\Program Files\\YourApp\\App.exe",
  "appium:smoothPointerMove": "ease-in-out",
  "appium:delayBeforeClick": 250,
  "appium:typeDelay": 20,
  "appium:powerShellCommandTimeout": 90000
}
```

### Background-tabbed app — attach without launching

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:appTopLevelWindow": "0x000A1234",
  "appium:shouldCloseApp": false
}
```

### Win-ARM64 host with no recording stack

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:app": "C:\\Program Files\\YourApp\\App.exe"
}
```

No special caps needed — the recording stack is in `optionalDependencies` and lazy-loaded; `windows: startRecordingScreen` will throw a clean error if invoked, but the rest of the driver works.

### Desktop-root session (system-level testing, no app)

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:app": "root"
}
```

## Full Capabilities Example

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "appium:app": "C:\\Windows\\System32\\notepad.exe",
  "appium:shouldCloseApp": true,
  "appium:smoothPointerMove": "ease-in-out",
  "appium:delayBeforeClick": 200,
  "appium:delayAfterClick": 100,
  "appium:typeDelay": 30,
  "appium:powerShellCommandTimeout": 30000
}
```

## See also

- [Error codes](./error-codes.md) — what each `InvalidArgumentError` from cap validation means
- [Finding Elements → searching from a context](./finding-elements.md#searching-from-an-element-context) — how `convertAbsoluteXPathToRelativeFromElement` and `includeContextElementInSearch` interact
- [Extensions → PowerShell escape hatch](./extensions.md#powershell-escape-hatch) — `isolatedScriptExecution`, `prerun`, `postrun` in context
