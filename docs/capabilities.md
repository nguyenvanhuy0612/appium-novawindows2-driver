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
