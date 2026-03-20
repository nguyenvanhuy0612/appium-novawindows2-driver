# Element Commands

Commands to interact with UI elements after finding them.

---

## `click(elementId)`

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

---

## `setValue(value, elementId)`

Types text into an element, supporting both plain text and special keys (Unicode PUA range).

**Behavior:**
- Tries `SetFocus` first.
- If `SetFocus` fails and the text is plain ASCII, falls back to `ValuePattern.SetValue`.
- Characters in the Unicode PUA range (`\uE000`–`\uF8FF`) are treated as special keys (see [Key enum](./action-sequences.md#key-constants)).
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

---

## `clear(elementId)`

Clears the text of an element using `ValuePattern.SetValue('')`.

```python
element.clear()
```

---

## `getText(elementId)`

Returns the text value of an element (via `ValuePattern` or the element's `Name` property).

```python
text = element.text
```

---

## `getName(elementId)`

Returns the **tag name** (UIA Control Type programmatic name, e.g. `"ControlType.Button"`).

```python
tag = element.tag_name
```

---

## `getProperty(propertyName, elementId)`

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

### Supported Pattern Names

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

---

## `getAttribute(propertyName, elementId)`

Alias for `getProperty`. Prefer using `getProperty` directly.

> ⚠️ A deprecation warning is logged when this is called.

```python
# Deprecated – use get_property instead
value = element.get_attribute("Name")
```

---

## `getElementRect(elementId)`

Returns the bounding rectangle of the element **relative to the application root window** (not the full screen).

**Returns:** `{ x, y, width, height }` (all integers)

```python
rect = element.rect
print(rect)  # { 'x': 100, 'y': 200, 'width': 80, 'height': 30 }
```

---

## `elementDisplayed(elementId)`

Returns `true` if the element is **not offscreen** (i.e., `IsOffscreen` is `false`).

```python
is_visible = element.is_displayed()
```

---

## `elementSelected(elementId)`

Returns `true` if the element is selected (via `SelectionItemPattern`) or toggled on (via `TogglePattern`).

```python
is_checked = element.is_selected()
```

---

## `elementEnabled(elementId)`

Returns `true` if the element's `IsEnabled` property is `true`.

```python
is_enabled = element.is_enabled()
```

---

## `active()`

Returns the element that currently has keyboard focus.

```python
focused = driver.switch_to.active_element
```

---

## `getElementScreenshot(elementId)`

Takes a screenshot of the element's bounding area and returns it as a base64-encoded PNG.

```python
png_b64 = element.screenshot_as_base64
```
