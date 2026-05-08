# Extensions

`windows:*` extension commands invoked via `driver.execute_script("windows: <command>", [args])`, plus the PowerShell escape hatch and screen recording.

- [Overview](#overview)
- [Mouse / Pointer](#mouse--pointer)
- [Keyboard](#keyboard)
- [UIA Patterns](#uia-patterns)
- [Selection](#selection)
- [Window State](#window-state)
- [Clipboard](#clipboard)
- [Misc](#misc)
- [PowerShell Escape Hatch](#powershell-escape-hatch)
- [Screen Recording](#screen-recording)

---

## Overview

| Command | Script string | Description |
|---|---|---|
| [click](#click) | `windows: click` | Flexible click with options |
| [hover](#hover) | `windows: hover` | Move mouse / hover with optional end target |
| [scroll](#scroll) | `windows: scroll` | Scroll wheel at a position |
| [clickAndDrag](#clickanddrag) | `windows: clickAndDrag` | Click and drag from one point/element to another |
| [keys](#keys) | `windows: keys` | Low-level keyboard input |
| [setFocus](#setfocus) | `windows: setFocus` | Give keyboard focus to an element |
| [invoke](#invoke) | `windows: invoke` | Invoke an element (InvokePattern) |
| [expand](#expand) | `windows: expand` | Expand an element (ExpandCollapsePattern) |
| [collapse](#collapse) | `windows: collapse` | Collapse an element |
| [toggle](#toggle) | `windows: toggle` | Toggle an element (TogglePattern) |
| [select](#select) | `windows: select` | Select an item (SelectionItemPattern) |
| [addToSelection](#addtoselection) | `windows: addToSelection` | Add to multi-selection |
| [removeFromSelection](#removefromselection) | `windows: removeFromSelection` | Remove from selection |
| [selectedItem](#selecteditem) | `windows: selectedItem` | Get the currently selected item |
| [allSelectedItems](#allselecteditems) | `windows: allSelectedItems` | Get all selected items |
| [isMultiple](#ismultiple) | `windows: isMultiple` | Check if multi-select is allowed |
| [scrollIntoView](#scrollintoview) | `windows: scrollIntoView` | Scroll an element into view |
| [getValue](#getvalue) | `windows: getValue` | Get value via ValuePattern/RangeValuePattern |
| [setValue](#setvalue) | `windows: setValue` | Set value via ValuePattern/RangeValuePattern |
| [maximize](#maximize) | `windows: maximize` | Maximize a window element |
| [minimize](#minimize) | `windows: minimize` | Minimize a window element |
| [restore](#restore) | `windows: restore` | Restore a window element |
| [close](#close) | `windows: close` | Close a window element |
| [getClipboard](#getclipboard) | `windows: getClipboard` | Get clipboard contents (base64) |
| [setClipboard](#setclipboard) | `windows: setClipboard` | Set clipboard contents (from base64) |
| [getAttributes](#getattributes) | `windows: getAttributes` | Get all element attributes as JSON |
| [typeDelay](#typedelay) | `windows: typeDelay` | Change the typing delay at runtime |
| [setProcessForeground](#setprocessforeground) | `windows: setProcessForeground` | Bring a process window to the foreground |
| [cacheRequest](#cacherequest) | `windows: cacheRequest` | Configure the UIA cache request |
| [startRecordingScreen](#startrecordingscreen) | `windows: startRecordingScreen` | Start screen recording |
| [stopRecordingScreen](#stoprecordingscreen) | `windows: stopRecordingScreen` | Stop screen recording and get the video |

---

## Mouse / Pointer

### click

Performs a mouse click at a position or on an element, with support for modifier keys, multi-click, and hold duration.

**Arguments:**

| Name | Type | Default | Description |
|---|---|---|---|
| `elementId` | `string` | — | Element's Runtime ID to click. If omitted, uses `x`/`y` |
| `x` | `number` | — | Absolute or element-relative X offset |
| `y` | `number` | — | Absolute or element-relative Y offset |
| `button` | `string` | `"left"` | Mouse button: `"left"`, `"middle"`, `"right"`, `"back"`, `"forward"` |
| `modifierKeys` | `string[]` | `[]` | Keys to hold: `"shift"`, `"ctrl"`, `"alt"`, `"win"` |
| `durationMs` | `number` | `0` | How long to hold the mouse button down (ms) |
| `times` | `number` | `1` | Number of clicks (e.g. `2` for double-click) |
| `interClickDelayMs` | `number` | `100` | Delay between multiple clicks |

> If no `elementId`, `x`, or `y` is given, the current cursor position is used.

```python
# Double right-click an element
el = driver.find_element(AppiumBy.XPATH, "//Button[@Name='File']")
driver.execute_script("windows: click", [{
    "elementId": el.id,
    "button": "right",
    "times": 2
}])

# Click at absolute screen coordinates with Ctrl held
driver.execute_script("windows: click", [{
    "x": 500, "y": 300,
    "modifierKeys": ["ctrl"]
}])
```

### hover

Moves the mouse to a position (optionally smoothly over a duration). Supports a start+end point for legacy drag-without-click behavior.

**Arguments:**

| Name | Type | Default | Description |
|---|---|---|---|
| `startElementId` | `string` | — | Element to start hover from |
| `startX` | `number` | — | Start X (element-relative if `startElementId` given, else absolute) |
| `startY` | `number` | — | Start Y |
| `endElementId` | `string` | — | Element to hover over at the end |
| `endX` | `number` | — | End X |
| `endY` | `number` | — | End Y |
| `modifierKeys` | `string[]` | `[]` | Modifier keys to hold during the hover |
| `durationMs` | `number` | `500` | Duration of the smooth mouse move (ms) |

> If no start target is given, the current cursor position is used as start.
> If no end target is given, the mouse moves smoothly from current position to start.

```python
# Hover over a menu item to reveal submenu
menu_item = driver.find_element(AppiumBy.NAME, "Edit")
driver.execute_script("windows: hover", [{"startElementId": menu_item.id, "durationMs": 300}])

# Move smoothly from element A to element B
driver.execute_script("windows: hover", [{
    "startElementId": element_a.id,
    "endElementId": element_b.id,
    "durationMs": 800,
}])
```

### scroll

Scrolls the mouse wheel at a position or element.

**Arguments:**

| Name | Type | Default | Description |
|---|---|---|---|
| `elementId` | `string` | — | Element to scroll at |
| `x` | `number` | — | Absolute or element-relative X |
| `y` | `number` | — | Absolute or element-relative Y |
| `deltaX` | `number` | `0` | Horizontal scroll delta (positive = right) |
| `deltaY` | `number` | `0` | Vertical scroll delta (positive = down) |
| `modifierKeys` | `string[]` | `[]` | Modifier keys to hold during scroll |

> If no `elementId`, `x`, or `y` is given, uses the current cursor position.

```python
# Scroll down on a list element
list_el = driver.find_element(AppiumBy.TAG_NAME, "List")
driver.execute_script("windows: scroll", [{
    "elementId": list_el.id,
    "deltaY": 3
}])
```

### clickAndDrag

Clicks and drags from one position/element to another.

**Arguments:**

| Name | Type | Default | Description |
|---|---|---|---|
| `startElementId` | `string` | — | Element to start drag from |
| `startX` | `number` | — | Start X (element-relative if element given) |
| `startY` | `number` | — | Start Y |
| `endElementId` | `string` | — | Element to drag to |
| `endX` | `number` | — | End X |
| `endY` | `number` | — | End Y |
| `button` | `string` | `"left"` | Mouse button to use for dragging |
| `modifierKeys` | `string[]` | `[]` | Modifier keys to hold during drag |
| `durationMs` | `number` | `1000` | Duration of the drag movement (ms) |
| `smoothPointerMove` | `string` | *(session cap)* | Override the easing function for this drag |

```python
driver.execute_script("windows: clickAndDrag", [{
    "startElementId": src.id,
    "endElementId": dst.id,
    "durationMs": 1500
}])
```

---

## Keyboard

### keys

Low-level keyboard input using virtual key codes or text characters.

**Arguments:** `{ actions: KeyAction | KeyAction[], forceUnicode?: boolean }`

Each `KeyAction` must have **exactly one** of:
- `pause: number` — sleep for the given milliseconds
- `text: string` — type each character as a key press (down + up)
- `virtualKeyCode: number` — send a Win32 virtual key code

Optional fields:
- `down: boolean` — if true, only press down; if false, only release; if omitted, press + release

```python
# Type text
driver.execute_script("windows: keys", [{"actions": [{"text": "Hello"}]}])

# Press Enter (VK_RETURN = 0x0D)
driver.execute_script("windows: keys", [{"actions": [{"virtualKeyCode": 0x0D}]}])

# Hold Ctrl, press C, release Ctrl
driver.execute_script("windows: keys", [{"actions": [
    {"virtualKeyCode": 0x11, "down": True},   # Ctrl down
    {"text": "c"},                             # C key
    {"virtualKeyCode": 0x11, "down": False},  # Ctrl up
]}])
```

### setFocus

Gives keyboard focus to an element via UIA `SetFocus`.

**Arguments:** An element object `{ ELEMENT: elementId }` or a W3C element ref.

```python
el = driver.find_element(AppiumBy.NAME, "Username")
driver.execute_script("windows: setFocus", [el])
```

### typeDelay

Dynamically changes the `typeDelay` capability at runtime (per-session, until changed again or session ends).

**Arguments:** `{ delay: number }`, or just a number.

```python
# Set 50ms delay between keystrokes
driver.execute_script("windows: typeDelay", [{"delay": 50}])
# Reset to instant
driver.execute_script("windows: typeDelay", [0])
```

---

## UIA Patterns

### invoke

Invokes an element using the UIA `InvokePattern`. Equivalent to clicking the element programmatically (e.g. for buttons).

```python
btn = driver.find_element(AppiumBy.NAME, "OK")
driver.execute_script("windows: invoke", [btn])
```

### expand

Expands an element using `ExpandCollapsePattern`.

```python
tree_item = driver.find_element(AppiumBy.NAME, "Documents")
driver.execute_script("windows: expand", [tree_item])
```

### collapse

Collapses an element using `ExpandCollapsePattern`.

```python
driver.execute_script("windows: collapse", [tree_item])
```

### toggle

Toggles an element using `TogglePattern` (e.g. checkboxes).

```python
checkbox = driver.find_element(AppiumBy.NAME, "Remember me")
driver.execute_script("windows: toggle", [checkbox])
```

### scrollIntoView

Scrolls an element into view using `ScrollItemPattern`, then `SetFocus`, then keyboard (`PageDown`) as fallback.

```python
el = driver.find_element(AppiumBy.NAME, "Last Item")
driver.execute_script("windows: scrollIntoView", [el])
# or using the Selenium JS shorthand:
driver.execute_script("arguments[0].scrollIntoView()", el)
```

### getValue

Gets the value of an element via `ValuePattern` (or `RangeValuePattern` as fallback).

```python
value = driver.execute_script("windows: getValue", [el])
```

### setValue

Sets the value of an element via `ValuePattern` (or `RangeValuePattern` as fallback).

```python
driver.execute_script("windows: setValue", [el, "new value"])
# For range: use numeric string
driver.execute_script("windows: setValue", [slider, "75"])
```

---

## Selection

### select

Selects an item using `SelectionItemPattern`.

```python
list_item = driver.find_element(AppiumBy.NAME, "Option A")
driver.execute_script("windows: select", [list_item])
```

### addToSelection

Adds an item to the current selection via `SelectionItemPattern.AddToSelection`.

```python
driver.execute_script("windows: addToSelection", [list_item])
```

### removeFromSelection

Removes an item from the current selection via `SelectionItemPattern.RemoveFromSelection`.

```python
driver.execute_script("windows: removeFromSelection", [list_item])
```

### selectedItem

Returns the first selected item in a container using `SelectionPattern`.

```python
container = driver.find_element(AppiumBy.TAG_NAME, "List")
selected = driver.execute_script("windows: selectedItem", [container])
```

### allSelectedItems

Returns all selected items in a container using `SelectionPattern`.

```python
all_selected = driver.execute_script("windows: allSelectedItems", [container])
```

### isMultiple

Returns `true` if the container supports multiple selection (`SelectionPattern.CanSelectMultiple`).

```python
can_multi = driver.execute_script("windows: isMultiple", [container])
```

---

## Window State

### maximize

Maximizes a window element via `WindowPattern.SetWindowVisualState`.

```python
window = driver.find_element(AppiumBy.TAG_NAME, "Window")
driver.execute_script("windows: maximize", [window])
```

### minimize

Minimizes a window element via `WindowPattern.SetWindowVisualState`.

```python
driver.execute_script("windows: minimize", [window])
```

### restore

Restores a minimized/maximized window to its normal state.

```python
driver.execute_script("windows: restore", [window])
```

### close

Closes a window element via `WindowPattern.Close`.

```python
driver.execute_script("windows: close", [window])
```

### setProcessForeground

Brings a process window to the foreground by process name.

**Arguments:** `{ process: string }` — the process name (without `.exe`).

```python
driver.execute_script("windows: setProcessForeground", [{"process": "notepad"}])
```

---

## Clipboard

### getClipboard

Gets the current clipboard content as a base64-encoded string.

**Arguments:** `{ contentType?: "plaintext" | "image" }` (defaults to `"plaintext"`)

```python
# Plain text
b64 = driver.execute_script("windows: getClipboard", [{"contentType": "plaintext"}])
import base64
text = base64.b64decode(b64).decode("utf-8")

# Image
b64_img = driver.execute_script("windows: getClipboard", [{"contentType": "image"}])
```

### setClipboard

Sets the clipboard content from a base64-encoded string.

**Arguments:** `{ b64Content: string, contentType?: "plaintext" | "image" }`

```python
import base64
b64 = base64.b64encode("Hello!".encode()).decode()
driver.execute_script("windows: setClipboard", [{"b64Content": b64, "contentType": "plaintext"}])
```

---

## Misc

### getAttributes

Returns all UIA properties of an element as a JSON string.

**Arguments:** An element object, an object with `elementId`, or a plain element ID string.

```python
el = driver.find_element(AppiumBy.NAME, "Username")
attrs_json = driver.execute_script("windows: getAttributes", [el])
import json
attrs = json.loads(attrs_json)
```

### cacheRequest

Configures the UIA `CacheRequest` used by the driver's PowerShell session. Affects the scope and filter of future element lookups.

**Arguments:**

| Name | Type | Description |
|---|---|---|
| `treeScope` | `string` | UIA `TreeScope` enum value (e.g. `"Children"`, `"Descendants"`, `"Subtree"`) |
| `treeFilter` | `string` | A UIA condition string (same format as `-windows uiautomation`) |
| `automationElementMode` | `string` | `"Full"` or `"None"` |

```python
driver.execute_script("windows: cacheRequest", [{
    "treeScope": "Subtree",
    "treeFilter": "IsEnabled=True"
}])
```

---

## PowerShell Escape Hatch

The driver exposes direct access to its persistent **PowerShell session**, allowing you to execute arbitrary PowerShell scripts within the same process that handles all UIA operations.

> ⚠️ **Security note:** Executing arbitrary PowerShell is a privileged operation. Enable this feature only when needed using the `POWER_SHELL` feature flag (see Appium featuresList configuration).

### `execute('powershell', args)`

Executes a PowerShell script in the driver's shared session (or an isolated session if `isolatedScriptExecution` is `true`).

**Arguments:** `[{ script: string } | { command: string }]`

- `script` and `command` are interchangeable — use whichever reads more clearly.

**Returns:** `string` — the trimmed stdout output of the script.

```python
# Run a simple command
result = driver.execute_script("powershell", [{"script": "Get-Date"}])
print(result)

# Read a registry value
reg_val = driver.execute_script("powershell", [{
    "script": "(Get-ItemProperty 'HKCU:\\Software\\MyApp').Version"
}])
```

#### Shared Session vs. Isolated Session

| Mode | Capability | Description |
|---|---|---|
| **Shared** (default) | `isolatedScriptExecution: false` | Script runs in the same PowerShell process as the driver. Variables set in one script are visible in later scripts. |
| **Isolated** | `isolatedScriptExecution: true` | Each script spawns a fresh `powershell.exe -NoProfile -Command` process. No shared state between scripts. |

```python
# Example: set a variable in shared session, use it later
driver.execute_script("powershell", [{"script": "$myVar = 42"}])
result = driver.execute_script("powershell", [{"script": "$myVar"}])
print(result)  # "42"
```

### Internals

#### `sendPowerShellCommand(command)` *(internal)*

The internal command-queue-based method that all driver commands use under the hood. Commands are queued and executed sequentially to prevent race conditions in the persistent session.

- Writes the command to the PowerShell stdin.
- Appends a sentinel marker (`___NOVA_WIN2_DRIVER_END___`) to detect output completion.
- Respects the `powerShellCommandTimeout` capability (default: 60 000 ms).
- On timeout, forcefully kills the PowerShell process tree using `taskkill /F /T`.

#### `sendIsolatedPowerShellCommand(command)` *(internal)*

Spawns a standalone `powershell.exe -NoProfile -Command <command>` process, waits for it to exit, and returns stdout. Used when `isolatedScriptExecution` is `true`.

#### Session Management

`startPowerShellSession()` runs automatically during `createSession`:

1. Spawns the persistent `powershell.exe -NoProfile -NoExit -Command -` process.
2. Sets UTF-8 encoding.
3. Loads required .NET assemblies: `UIAutomationClient`, `System.Drawing`, `PresentationCore`, `System.Windows.Forms`.
4. Initialises the `CacheRequest`, element table, and PowerShell helper functions (`Get-PageSource`, `Find-ChildrenRecursively`, MSAA helpers, etc.).
5. Sets the **root element** based on capabilities (`app`, `appTopLevelWindow`).

`terminatePowerShellSession()` runs automatically during `deleteSession`. Closes stdin to trigger a graceful exit, with a 5-second timeout before `SIGKILL`.

### Available PowerShell Variables & Functions

The following globals and helper functions are pre-defined in the shared PowerShell session:

| Name | Type | Description |
|---|---|---|
| `$rootElement` | `[AutomationElement]` | The UIA search root (application window or desktop root) |
| `$elementTable` | `Dictionary<string, AutomationElement>` | Cache of element ID → `AutomationElement` mappings |
| `$cacheRequest` | `[CacheRequest]` | The active UIA cache request |
| `Get-PageSource` | Function | Recursively builds the XML element tree for a given element |
| `Find-ChildrenRecursively` | Function | Finds first matching child at any depth |
| `Find-AllChildrenRecursively` | Function | Finds all matching children at any depth |
| `Find-Descendant` | Function | Finds first descendant matching a condition |
| `Find-AllDescendants` | Function | Finds all descendants matching a condition |
| `Get-LegacyPropertySafe` | Function | Safely reads MSAA/LegacyIAccessible properties |
| `[MSAAHelper]` | Class | Compiled C# helper for Win32 accessibility APIs |

#### Using `$rootElement` and `$elementTable`

```python
# Find an element by name in PowerShell
el_id = driver.execute_script("powershell", [{
    "script": """
        $el = $rootElement.FindFirst(
            [System.Windows.Automation.TreeScope]::Descendants,
            [System.Windows.Automation.PropertyCondition]::new(
                [System.Windows.Automation.AutomationElement]::NameProperty,
                'OK'
            )
        )
        if ($el) {
            $id = ($el.GetCurrentPropertyValue([System.Windows.Automation.AutomationElement]::RuntimeIdProperty)) -join '.'
            $elementTable[$id] = $el
            Write-Output $id
        }
    """
}])

# The returned ID can now be used with standard Appium commands
from selenium.webdriver.common.by import By
element = driver.find_element(By.ID, el_id)
element.click()
```

### Error Handling

If a PowerShell script writes to `stderr` (e.g., via `Write-Error`, exceptions, etc.), the driver:
1. Logs the error using the driver logger.
2. Decodes the raw command for debugging.
3. Throws an `UnknownError` with the stderr message.

```python
try:
    driver.execute_script("powershell", [{"script": "throw 'Something went wrong'"}])
except Exception as e:
    print(e)  # Contains "Something went wrong"
```

---

## Screen Recording

The driver supports recording the screen during a test session using **FFmpeg** (via `gdigrab` for Windows desktop capture).

> **Note:** Screen recording requires the `ffmpeg-static` package to be installed. On ARM machines or unsupported architectures, `ffmpeg-static` may not be available and screen recording will not work.

### startRecordingScreen

**Extension command:** `windows: startRecordingScreen`

Starts capturing the screen. If a recording is already in progress, it is stopped first.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fps` | `number` | `15` | Frames per second for the video output |
| `timeLimit` | `number` | `600` (10 min) | Maximum recording duration in seconds |
| `preset` | `string` | `"veryfast"` | FFmpeg H.264 encoding preset (affects quality/speed trade-off). Values: `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow` |
| `captureCursor` | `boolean` | `false` | Whether to capture the mouse cursor in the video |
| `captureClicks` | `boolean` | `false` | Whether to visually highlight mouse clicks in the video |
| `audioInput` | `string` | — | Name of the audio input device for audio recording (e.g. `"Microphone (Realtek Audio)"`) |
| `videoFilter` | `string` | — | Custom FFmpeg `-filter:v` argument (e.g. `"scale=1280:720"`) |

```python
# Basic recording
driver.execute_script("windows: startRecordingScreen", [{}])

# High quality with cursor visible
driver.execute_script("windows: startRecordingScreen", [{
    "fps": 30,
    "preset": "fast",
    "captureCursor": True,
    "captureClicks": True,
    "timeLimit": 300
}])
```

### stopRecordingScreen

**Extension command:** `windows: stopRecordingScreen`

Stops the current screen recording and returns the captured video.

#### Upload Options

| Option | Type | Default | Description |
|---|---|---|---|
| `remotePath` | `string` | — | If provided, the video is uploaded to this URL via HTTP PUT (by default) |
| `user` | `string` | — | HTTP Basic Auth username for the upload |
| `pass` | `string` | — | HTTP Basic Auth password for the upload |
| `method` | `string` | `"PUT"` | HTTP method for the upload |
| `headers` | `object` | — | Custom HTTP headers for the upload request |
| `fileFieldName` | `string` | — | Form field name when using `multipart/form-data` upload |
| `formFields` | `object\|array` | — | Additional form fields for `multipart/form-data` upload |

#### Return value

- If `remotePath` is **not** set: returns the video as a **base64-encoded MP4 string**.
- If `remotePath` **is** set: uploads the file and returns an empty string `""`.

```python
# Stop and get base64
b64_video = driver.execute_script("windows: stopRecordingScreen", [{}])

# Decode and save to disk
import base64

with open("recording.mp4", "wb") as f:
    f.write(base64.b64decode(b64_video))

# Stop and upload to remote
driver.execute_script("windows: stopRecordingScreen", [{
    "remotePath": "https://example.com/upload/video.mp4",
    "user": "admin",
    "pass": "secret"
}])
```

### Full Workflow Example

```python
import base64
from appium import webdriver
from appium.options import AppiumOptions

options = AppiumOptions()
options.platform_name = "Windows"
options.automation_name = "NovaWindows2"
options.app = r"C:\Windows\System32\notepad.exe"

driver = webdriver.Remote("http://localhost:4723", options=options)

# --- Start recording ---
driver.execute_script("windows: startRecordingScreen", [{
    "fps": 15,
    "captureCursor": True,
    "timeLimit": 120
}])

# --- Do your test actions ---
edit = driver.find_element("xpath", "//Edit")
edit.send_keys("Hello from Appium!")

# --- Stop recording ---
b64 = driver.execute_script("windows: stopRecordingScreen", [{}])
with open("test_recording.mp4", "wb") as f:
    f.write(base64.b64decode(b64))

driver.quit()
```

### Notes

- The recording is saved to a temp file on the Windows machine during capture.
- The temp file is deleted after `stopRecordingScreen` completes (whether returned as base64 or uploaded).
- If the session ends while a recording is in progress (e.g., due to a crash), the recording is forcefully stopped and the temporary file is cleaned up automatically.
- The video uses the `libx264` codec with YUV 4:2:0 pixel format for broad compatibility.
- The `movflags +faststart` flag is used so the video is streamable without needing to download the full file.

---

## Security model

Most extension commands are **safe by default** — they manipulate UIA elements within the targeted application, no different from a real user.

Three categories require explicit security relaxation:

### Privileged: PowerShell escape hatch

`execute_script("powershell", ...)` runs arbitrary PowerShell in the driver's session. This is **privileged** — Appium gates it via the `power_shell` insecure feature flag.

Enable on the Appium command line:

```bash
appium --allow-insecure power_shell             # allow only this feature
# or
appium --relaxed-security                       # allow all insecure features
```

### Sensitive: clipboard

`windows: getClipboard` / `windows: setClipboard` access the user's clipboard, which may contain credentials, API keys, or other sensitive data left there by other applications. Not gated by a feature flag, but treat the data carefully — don't log clipboard contents in test artefacts.

### Untrusted input — argument validation

These extensions accept user-controlled string input that gets interpolated into PowerShell. The driver validates them strictly:

| Command | Validation |
|---|---|
| `windows: cacheRequest` | `treeFilter` parsed via the [DSL](./finding-elements.md#the--windows-uiautomation-selector-dsl). Malformed input → `InvalidArgumentError` |
| `windows: setProcessForeground` | `process` name is interpolated into a `Get-Process -Name '...'` call. Use safe characters only |
| `pushFile` (in `commands.md`) | `data` validated as base64 since 1.1.9. `path` quotes single quotes (`'` → `''`). Closes a PS-injection vector — see [code-review #4](../code-review/2026-05-08.md) |

If you're driving the driver from a context where extension args themselves are untrusted (e.g. accepting test scripts from end users), favour `appium:isolatedScriptExecution: true` for `powerShell` calls, and never pass untrusted strings through `windows: cacheRequest`'s `treeFilter`.

## Choosing the right tool

When multiple commands can do the same thing, pick the most direct.

### Click vs invoke

| Use | When |
|---|---|
| `element.click()` (W3C) | Standard interaction. Includes scroll-into-view + foreground + native mouse |
| `windows: click` | Need modifier keys, multi-click, hold-duration, or coordinates instead of an element |
| `windows: invoke` | Element exposes `InvokePattern` (most buttons do). Direct programmatic invoke — bypasses mouse, scroll, foreground |

Programmatic `invoke` is fastest and most reliable but won't trigger UI behaviour that depends on actual mouse movement (hover effects, drag detection).

### setValue vs keys

| Use | When |
|---|---|
| `element.send_keys(...)` (W3C) | Standard text input. Goes through `setValue` — focus + type + ValuePattern fallback |
| `windows: keys` | Need virtual key codes, fine-grained press/release timing, or text without focusing an element first |

### Window state

| Use | When |
|---|---|
| `driver.maximize_window()` (W3C) | Standard. Operates on the session's root window |
| `windows: maximize` | Operates on a specific element (some apps have nested windows where the root isn't what you want) |

### Recording

Always via the extensions — there's no W3C standard for screen recording.

## See also

- [Commands](./commands.md) — W3C-standard commands (the safer alternative when there's overlap)
- [Capabilities → PowerShell](./capabilities.md#powershell-capabilities) — `isolatedScriptExecution`, `powerShellCommandTimeout`
- [Architecture → PowerShell session](../architecture/powershell-session.md) — how `powershell` calls actually run
- [Error codes](./error-codes.md) — what `UnknownError` from a `windows:*` command actually means
