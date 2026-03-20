# Extension Commands

Extension commands are invoked via `driver.execute_script("windows: <command>", [args])`.

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

## click

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

---

## hover

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

---

## scroll

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

---

## clickAndDrag

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

## keys

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

---

## setFocus

Gives keyboard focus to an element via UIA `SetFocus`.

**Arguments:** An element object `{ ELEMENT: elementId }` or a W3C element ref.

```python
el = driver.find_element(AppiumBy.NAME, "Username")
driver.execute_script("windows: setFocus", [el])
```

---

## invoke

Invokes an element using the UIA `InvokePattern`. Equivalent to clicking the element programmatically (e.g. for buttons).

```python
btn = driver.find_element(AppiumBy.NAME, "OK")
driver.execute_script("windows: invoke", [btn])
```

---

## expand

Expands an element using `ExpandCollapsePattern`.

```python
tree_item = driver.find_element(AppiumBy.NAME, "Documents")
driver.execute_script("windows: expand", [tree_item])
```

---

## collapse

Collapses an element using `ExpandCollapsePattern`.

```python
driver.execute_script("windows: collapse", [tree_item])
```

---

## toggle

Toggles an element using `TogglePattern` (e.g. checkboxes).

```python
checkbox = driver.find_element(AppiumBy.NAME, "Remember me")
driver.execute_script("windows: toggle", [checkbox])
```

---

## select

Selects an item using `SelectionItemPattern`.

```python
list_item = driver.find_element(AppiumBy.NAME, "Option A")
driver.execute_script("windows: select", [list_item])
```

---

## addToSelection

Adds an item to the current selection via `SelectionItemPattern.AddToSelection`.

```python
driver.execute_script("windows: addToSelection", [list_item])
```

---

## removeFromSelection

Removes an item from the current selection via `SelectionItemPattern.RemoveFromSelection`.

```python
driver.execute_script("windows: removeFromSelection", [list_item])
```

---

## selectedItem

Returns the first selected item in a container using `SelectionPattern`.

```python
container = driver.find_element(AppiumBy.TAG_NAME, "List")
selected = driver.execute_script("windows: selectedItem", [container])
```

---

## allSelectedItems

Returns all selected items in a container using `SelectionPattern`.

```python
all_selected = driver.execute_script("windows: allSelectedItems", [container])
```

---

## isMultiple

Returns `true` if the container supports multiple selection (`SelectionPattern.CanSelectMultiple`).

```python
can_multi = driver.execute_script("windows: isMultiple", [container])
```

---

## scrollIntoView

Scrolls an element into view using `ScrollItemPattern`, then `SetFocus`, then keyboard (`PageDown`) as fallback.

```python
el = driver.find_element(AppiumBy.NAME, "Last Item")
driver.execute_script("windows: scrollIntoView", [el])
# or using the Selenium JS shorthand:
driver.execute_script("arguments[0].scrollIntoView()", el)
```

---

## getValue

Gets the value of an element via `ValuePattern` (or `RangeValuePattern` as fallback).

```python
value = driver.execute_script("windows: getValue", [el])
```

---

## setValue

Sets the value of an element via `ValuePattern` (or `RangeValuePattern` as fallback).

```python
driver.execute_script("windows: setValue", [el, "new value"])
# For range: use numeric string
driver.execute_script("windows: setValue", [slider, "75"])
```

---

## maximize

Maximizes a window element via `WindowPattern.SetWindowVisualState`.

```python
window = driver.find_element(AppiumBy.TAG_NAME, "Window")
driver.execute_script("windows: maximize", [window])
```

---

## minimize

Minimizes a window element via `WindowPattern.SetWindowVisualState`.

```python
driver.execute_script("windows: minimize", [window])
```

---

## restore

Restores a minimized/maximized window to its normal state.

```python
driver.execute_script("windows: restore", [window])
```

---

## close

Closes a window element via `WindowPattern.Close`.

```python
driver.execute_script("windows: close", [window])
```

---

## getClipboard

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

---

## setClipboard

Sets the clipboard content from a base64-encoded string.

**Arguments:** `{ b64Content: string, contentType?: "plaintext" | "image" }`

```python
import base64
b64 = base64.b64encode("Hello!".encode()).decode()
driver.execute_script("windows: setClipboard", [{"b64Content": b64, "contentType": "plaintext"}])
```

---

## getAttributes

Returns all UIA properties of an element as a JSON string.

**Arguments:** An element object, an object with `elementId`, or a plain element ID string.

```python
el = driver.find_element(AppiumBy.NAME, "Username")
attrs_json = driver.execute_script("windows: getAttributes", [el])
import json
attrs = json.loads(attrs_json)
```

---

## typeDelay

Dynamically changes the `typeDelay` capability at runtime (per-session, until changed again or session ends).

**Arguments:** `{ delay: number }`, or just a number.

```python
# Set 50ms delay between keystrokes
driver.execute_script("windows: typeDelay", [{"delay": 50}])
# Reset to instant
driver.execute_script("windows: typeDelay", [0])
```

---

## setProcessForeground

Brings a process window to the foreground by process name.

**Arguments:** `{ process: string }` — the process name (without `.exe`).

```python
driver.execute_script("windows: setProcessForeground", [{"process": "notepad"}])
```

---

## cacheRequest

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

## startRecordingScreen

Starts recording the screen using `ffmpeg` (via `gdigrab`). See [Screen Recording](./screen-recording.md) for full options.

```python
driver.execute_script("windows: startRecordingScreen", [{"fps": 30, "timeLimit": 120}])
```

---

## stopRecordingScreen

Stops the screen recording and returns the video as a base64-encoded MP4, or uploads it to a remote URL.

```python
b64_video = driver.execute_script("windows: stopRecordingScreen", [{}])
```
