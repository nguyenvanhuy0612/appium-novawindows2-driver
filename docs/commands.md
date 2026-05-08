# Commands

Standard W3C-protocol commands exposed by the driver — application/window-level, element-level, and the W3C Actions API. For `windows:` extension commands see [Extensions](./extensions.md).

- [App / Window](#app--window)
- [Element](#element)
- [Action Sequences (W3C)](#action-sequences-w3c)

---

## App / Window

Commands for managing the application, windows, and page-level information.

### `getPageSource()`

Returns the full XML representation of the current UIA element tree.

Each XML element tag corresponds to a UIA Control Type. Attributes include all standard UIA properties plus bounding rectangle coordinates (`x`, `y`, `width`, `height`, relative to the root window).

```python
source = driver.page_source
print(source)
# <Window Name="Notepad" ...>
#   <TitleBar .../>
#   <Edit Name="Text Editor" .../>
# </Window>
```

### `getScreenshot()`

Takes a full screenshot of the application window (or the entire desktop if `app=root`) and returns it as a base64-encoded PNG.

If a specific app is targeted (not `root`), this command attempts to bring the window to the foreground first via `SetForegroundWindow`.

```python
png_b64 = driver.get_screenshot_as_base64()
# or save to file:
driver.save_screenshot("screenshot.png")
```

### `getWindowRect()`

Returns the bounding rectangle of the current root (application) window in **screen coordinates**.

**Returns:** `{ x, y, width, height }` (all integers in pixels)

```python
rect = driver.get_window_rect()
print(rect)  # { 'x': 0, 'y': 0, 'width': 1920, 'height': 1080 }
```

### `getWindowHandle()`

Returns the native Win32 window handle of the current root element as a zero-padded 8-character hex string (e.g. `"0x00010ABC"`).

```python
handle = driver.current_window_handle
print(handle)  # "0x00010ABC"
```

### `getWindowHandles()`

Returns a list of native window handles for all **top-level windows** currently on the desktop (children of the desktop root element).

Each handle is formatted as an 8-character zero-padded hex string.

```python
handles = driver.window_handles
for handle in handles:
    print(handle)
```

### `setWindow(nameOrHandle)`

Switches to a window by its **native handle** (as a number in decimal/hex string) or by its **Name** property.

The driver retries up to 20 times with 500 ms sleep between retries (useful for windows that are still starting up). Calling `SetForegroundWindow` is also attempted.

Throws `NoSuchWindowError` if the window is not found after all retries.

```python
# Switch by handle (hex string accepted by WebDriver)
driver.switch_to.window("0x00010ABC")

# Switch by window name
driver.switch_to.window("Notepad")
```

### `changeRootElement(pathOrNativeWindowHandle)`

**Extension command** — changes the UIA search root to a different window. Used internally by the driver during session creation or when switching windows.

| Overload | Description |
|---|---|
| `changeRootElement(nativeWindowHandle: number)` | Switch root to the window matching an integer native window handle |
| `changeRootElement(path: string)` | Launch an app and wait for its window to appear, then switch root to it. Supports UWP app IDs and classic `.exe` paths |

This command is called automatically when `setWindow` is used, but can also be invoked via PowerShell scripts.

### `attachToApplicationWindow(processIds, attemptNumber?)`

**Internal command** — attempts to attach the root element to the main window belonging to one of the given process IDs. Called by `changeRootElement` after launching an app.

- Iterates process IDs in priority order (newest process first for the first 6 attempts).
- Tries `SetForegroundWindow` and then UIA `SetFocus` to bring the window to the front.
- Throws `UnknownError` if no matching window is found.

> This is an internal command and is not typically called directly.

---

## Element

Commands to interact with UI elements after finding them.

### `click(elementId)`

Clicks the center of an element using native mouse input.

**Sequence:**
1. Finds the nearest Window/Pane ancestor and brings it to the foreground (via `SetFocus` or `SetForegroundWindow`).
2. Scrolls the element into view (`ScrollItemPattern`, then `SetFocus`, then keyboard fallback).
3. Moves the mouse to the element's **clickable point** (or bounding-rect center).
4. Performs `mouseDown` + `mouseUp`.
5. Waits `delayAfterClick` ms if set.

**Capability influences:** `smoothPointerMove`, `delayBeforeClick` (applied as move duration), `delayAfterClick`.

```python
element = driver.find_element(AppiumBy.XPATH, "//Button[@Name='OK']")
element.click()
```

### `setValue(value, elementId)`

Types text into an element, supporting both plain text and special keys (Unicode PUA range).

**Behavior:**
- Tries `SetFocus` first.
- If `SetFocus` fails and the text is plain ASCII, falls back to `ValuePattern.SetValue`.
- Characters in the Unicode PUA range (``–``) are treated as special keys (see [Key Constants](#key-constants)).
- Modifier keys (Shift, Ctrl, Alt, Meta) are toggled and automatically released at the end if `releaseModifierKeys` is `true`.
- Supports a per-call delay prefix: passing `"[delay:50]Hello"` overrides the session `typeDelay` for that call.

**Capability influences:** `typeDelay`, `releaseModifierKeys`.

```python
element.send_keys("Hello, World!")

# With delay prefix (overrides typeDelay cap for this call)
element.send_keys("[delay:50]Slow typing")

# With special key (Ctrl+A to select all, then type)
from appium.webdriver.extensions.keyboard import Keys
element.send_keys(Keys.CONTROL + "a" + Keys.CONTROL + "Hello")
```

### `clear(elementId)`

Clears the text of an element using `ValuePattern.SetValue('')`.

```python
element.clear()
```

### `getText(elementId)`

Returns the text value of an element (via `ValuePattern` or the element's `Name` property).

```python
text = element.text
```

### `getName(elementId)`

Returns the **tag name** (UIA Control Type programmatic name, e.g. `"ControlType.Button"`).

```python
tag = element.tag_name
```

### `getProperty(propertyName, elementId)`

Retrieves a UIA property or pattern property value for an element. This is the primary way to read any element attribute.

**Resolution order:**
1. **Legacy shorthand aliases** – `LegacyName`, `LegacyValue`, `LegacyDescription`, `LegacyRole`, `LegacyState`, `LegacyHelp`, `LegacyKeyboardShortcut`, `LegacyDefaultAction`, `LegacyChildId`
2. **`LegacyIAccessible.PropName`** – e.g. `"LegacyIAccessible.Name"`, `"LegacyIAccessible.Role"`
3. **UIA Pattern dot-notation** – `"PatternName.PropertyName"` e.g. `"Toggle.ToggleState"`, `"Value.Value"`, `"Window.CanMaximize"`, `"RangeValue.Value"`, `"ExpandCollapse.ExpandCollapseState"`
4. **`source`** – Returns the full XML source for the element subtree
5. **`all`** – Returns all element properties as a JSON string
6. **Direct UIA property** – `"Name"`, `"AutomationId"`, `"ClassName"`, `"RuntimeId"`, `"ControlType"`, `"IsEnabled"`, `"IsOffscreen"`, etc.

> For Win32/MSAA proxy elements, `getProperty` automatically falls back to `LegacyIAccessiblePattern` for: `Value.Value`, `Name`, `HelpText`, `AccessKey`, `AcceleratorKey`.

```python
# Direct UIA property
name    = driver.get_property(element, "Name")
classNm = driver.get_property(element, "ClassName")
enabled = driver.get_property(element, "IsEnabled")

# Pattern property
toggle_state = driver.get_property(element, "Toggle.ToggleState")
value        = driver.get_property(element, "Value.Value")
can_max      = driver.get_property(element, "Window.CanMaximize")

# All properties as JSON
all_props = driver.get_property(element, "all")

# XML subtree source
xml_source = driver.get_property(element, "source")

# Legacy MSAA
legacy_name = driver.get_property(element, "LegacyName")
```

#### Supported Pattern Names

| Pattern key | UIA Pattern class |
|---|---|
| `value` | `ValuePattern` |
| `window` | `WindowPattern` |
| `transform` | `TransformPattern` |
| `toggle` | `TogglePattern` |
| `expandcollapse` | `ExpandCollapsePattern` |
| `rangevalue` | `RangeValuePattern` |
| `selection` | `SelectionPattern` |
| `selectionitem` | `SelectionItemPattern` |
| `scroll` | `ScrollPattern` |
| `grid` | `GridPattern` |
| `griditem` | `GridItemPattern` |
| `table` | `TablePattern` |
| `tableitem` | `TableItemPattern` |
| `dock` | `DockPattern` |
| `multipleview` | `MultipleViewPattern` |
| `annotation` | `AnnotationPattern` |
| `drag` | `DragPattern` |
| `droptarget` | `DropTargetPattern` |
| `spreadsheet` | `SpreadsheetPattern` |
| `spreadsheetitem` | `SpreadsheetItemPattern` |
| `styles` | `StylesPattern` |
| `text` | `TextPattern` |
| `textchild` | `TextChildPattern` |
| `transform2` / `transformpattern2` | `TransformPattern2` |
| `selection2` / `selectionpattern2` | `SelectionPattern2` |
| `textpattern2` | `TextPattern2` |

### `getAttribute(propertyName, elementId)`

Alias for `getProperty`. Prefer using `getProperty` directly.

> ⚠️ A deprecation warning is logged when this is called.

```python
# Deprecated – use get_property instead
value = element.get_attribute("Name")
```

### `getElementRect(elementId)`

Returns the bounding rectangle of the element **relative to the application root window** (not the full screen).

**Returns:** `{ x, y, width, height }` (all integers)

```python
rect = element.rect
print(rect)  # { 'x': 100, 'y': 200, 'width': 80, 'height': 30 }
```

### `elementDisplayed(elementId)`

Returns `true` if the element is **not offscreen** (i.e., `IsOffscreen` is `false`).

```python
is_visible = element.is_displayed()
```

### `elementSelected(elementId)`

Returns `true` if the element is selected (via `SelectionItemPattern`) or toggled on (via `TogglePattern`).

```python
is_checked = element.is_selected()
```

### `elementEnabled(elementId)`

Returns `true` if the element's `IsEnabled` property is `true`.

```python
is_enabled = element.is_enabled()
```

### `active()`

Returns the element that currently has keyboard focus.

```python
focused = driver.switch_to.active_element
```

### `getElementScreenshot(elementId)`

Takes a screenshot of the element's bounding area and returns it as a base64-encoded PNG.

```python
png_b64 = element.screenshot_as_base64
```

---

## Action Sequences (W3C)

The driver implements the [W3C WebDriver Actions API](https://w3c.github.io/webdriver/#actions) for composing complex input sequences involving keyboard, mouse, and wheel events.

**Supported input source types:**

| Type | Description |
|---|---|
| `key` | Keyboard key press/release events |
| `pointer` | Mouse move, button down/up |
| `wheel` | Mouse wheel scroll |
| `none` | Pause/timing |

### Keyboard Actions (`key` type)

#### Key down / Key up

Sends a key press or release event using the Win32 `keybd_event` API.

**Modifier keys** (`Shift`, `Ctrl`, `Alt`, `Meta`/Win) are tracked in `keyboardState` and automatically paired — releasing the key also releases the opposite-hand variant (e.g., releasing `Shift` also releases `R_SHIFT`).

**`Key.NULL` (``)** on keyDown releases all currently held modifier keys and clears the tracked pressed-key set.

```python
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

actions = ActionChains(driver)
# Select all text (Ctrl+A)
actions.key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL)
actions.perform()
```

#### Key Constants

All WebDriver standard keys are supported. The driver processes Unicode PUA characters in the ``–`` range:

| Constant | Unicode | Description |
|---|---|---|
| `Key.NULL` | `` | Release all held modifiers |
| `Key.CANCEL` | `` | Cancel |
| `Key.HELP` | `` | Help |
| `Key.BACKSPACE` | `` | Backspace |
| `Key.TAB` | `` | Tab |
| `Key.CLEAR` | `` | Clear |
| `Key.RETURN` | `` | Return |
| `Key.ENTER` | `` | Enter |
| `Key.SHIFT` | `` | Left Shift |
| `Key.CONTROL` | `` | Left Control |
| `Key.ALT` | `` | Left Alt |
| `Key.PAUSE` | `` | Pause |
| `Key.ESCAPE` | `` | Escape |
| `Key.SPACE` | `` | Space |
| `Key.PAGE_UP` | `` | Page Up |
| `Key.PAGE_DOWN` | `` | Page Down |
| `Key.END` | `` | End |
| `Key.HOME` | `` | Home |
| `Key.LEFT` | `` | Arrow Left |
| `Key.UP` | `` | Arrow Up |
| `Key.RIGHT` | `` | Arrow Right |
| `Key.DOWN` | `` | Arrow Down |
| `Key.INSERT` | `` | Insert |
| `Key.DELETE` | `` | Delete |
| `Key.F1`–`F12` | ``–`` | Function keys |
| `Key.META` | `` | Left Win/Meta |
| `Key.R_SHIFT` | `` | Right Shift |
| `Key.R_CONTROL` | `` | Right Control |
| `Key.R_ALT` | `` | Right Alt |
| `Key.R_META` | `` | Right Win/Meta |

### Pointer Actions (`pointer` type)

Mouse pointer actions move the cursor and press/release mouse buttons.

#### `pointerMove`

Moves the mouse cursor to a target position.

**`origin` values:**

| Origin | Behavior |
|---|---|
| `"viewport"` (default) | `(x, y)` is relative to the top-left of the application root window |
| `"pointer"` | `(x, y)` is a relative offset from the **current cursor position** |
| element reference | `(x, y)` is relative to the **center** of the element (or offset from top-left if non-zero) |

If the element's bounding rect contains `Infinity` values, a scroll-into-view is attempted first.

**Smooth movement:** If the `smoothPointerMove` capability is set (e.g., `"ease-in-out"`), the cursor moves smoothly over the `duration` period.

```python
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.wheel_input import ScrollOrigin

actions = ActionChains(driver)

# Move to absolute position (relative to app window top-left)
actions.w3c_actions.pointer_action.move_to_location(200, 300)

# Move to element
el = driver.find_element(AppiumBy.NAME, "Submit")
actions.move_to_element(el)
actions.perform()
```

#### `pointerDown` / `pointerUp`

Press or release a mouse button.

| Button index | Button |
|---|---|
| `0` | Left mouse button |
| `1` | Middle mouse button |
| `2` | Right mouse button |

```python
actions = ActionChains(driver)
actions.click(element)   # pointerMove + pointerDown + pointerUp
actions.perform()
```

#### `pause`

Pauses the pointer action sequence for `duration` milliseconds.

### Wheel Actions (`wheel` type)

Scroll the mouse wheel at a position.

#### `scroll`

| Field | Description |
|---|---|
| `origin` | Same as `pointerMove` origin (viewport, pointer, element) |
| `x`, `y` | Coordinates (relative to origin) |
| `deltaX` | Horizontal scroll amount (positive = right) |
| `deltaY` | Vertical scroll amount (positive = down) |
| `duration` | Move duration before scroll |

```python
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.wheel_input import ScrollOrigin

el = driver.find_element(AppiumBy.TAG_NAME, "List")
origin = ScrollOrigin.from_element(el)
ActionChains(driver).scroll_from_origin(origin, 0, 5).perform()
```

### Null Actions (`none` type)

Used for timing/pause only.

```python
actions = ActionChains(driver)
actions.pause(500)  # wait 500ms
actions.perform()
```

### Full Example: Drag and Drop

```python
from selenium.webdriver.common.action_chains import ActionChains

source = driver.find_element(AppiumBy.NAME, "DragMe")
target = driver.find_element(AppiumBy.NAME, "DropHere")

ActionChains(driver).drag_and_drop(source, target).perform()
```

### Full Example: Right-Click Context Menu

```python
element = driver.find_element(AppiumBy.NAME, "File")
ActionChains(driver).context_click(element).perform()
```
