# Action Sequences

The driver implements the [W3C WebDriver Actions API](https://w3c.github.io/webdriver/#actions) for composing complex input sequences involving keyboard, mouse, and wheel events.

**Supported input source types:**

| Type | Description |
|---|---|
| `key` | Keyboard key press/release events |
| `pointer` | Mouse move, button down/up |
| `wheel` | Mouse wheel scroll |
| `none` | Pause/timing |

---

## Keyboard Actions (`key` type)

### Key down / Key up

Sends a key press or release event using the Win32 `keybd_event` API.

**Modifier keys** (`Shift`, `Ctrl`, `Alt`, `Meta`/Win) are tracked in `keyboardState` and automatically paired — releasing the key also releases the opposite-hand variant (e.g., releasing `Shift` also releases `R_SHIFT`).

**`Key.NULL` (`\uE000`)** on keyDown releases all currently held modifier keys and clears the tracked pressed-key set.

```python
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

actions = ActionChains(driver)
# Select all text (Ctrl+A)
actions.key_down(Keys.CONTROL).send_keys("a").key_up(Keys.CONTROL)
actions.perform()
```

### Key Constants

All WebDriver standard keys are supported. The driver processes Unicode PUA characters in the `\uE000`–`\uF8FF` range:

| Constant | Unicode | Description |
|---|---|---|
| `Key.NULL` | `\uE000` | Release all held modifiers |
| `Key.CANCEL` | `\uE001` | Cancel |
| `Key.HELP` | `\uE002` | Help |
| `Key.BACKSPACE` | `\uE003` | Backspace |
| `Key.TAB` | `\uE004` | Tab |
| `Key.CLEAR` | `\uE005` | Clear |
| `Key.RETURN` | `\uE006` | Return |
| `Key.ENTER` | `\uE007` | Enter |
| `Key.SHIFT` | `\uE008` | Left Shift |
| `Key.CONTROL` | `\uE009` | Left Control |
| `Key.ALT` | `\uE00A` | Left Alt |
| `Key.PAUSE` | `\uE00B` | Pause |
| `Key.ESCAPE` | `\uE00C` | Escape |
| `Key.SPACE` | `\uE00D` | Space |
| `Key.PAGE_UP` | `\uE00E` | Page Up |
| `Key.PAGE_DOWN` | `\uE00F` | Page Down |
| `Key.END` | `\uE010` | End |
| `Key.HOME` | `\uE011` | Home |
| `Key.LEFT` | `\uE012` | Arrow Left |
| `Key.UP` | `\uE013` | Arrow Up |
| `Key.RIGHT` | `\uE014` | Arrow Right |
| `Key.DOWN` | `\uE015` | Arrow Down |
| `Key.INSERT` | `\uE016` | Insert |
| `Key.DELETE` | `\uE017` | Delete |
| `Key.F1`–`F12` | `\uE031`–`\uE03C` | Function keys |
| `Key.META` | `\uE03D` | Left Win/Meta |
| `Key.R_SHIFT` | `\uE050` | Right Shift |
| `Key.R_CONTROL` | `\uE051` | Right Control |
| `Key.R_ALT` | `\uE052` | Right Alt |
| `Key.R_META` | `\uE053` | Right Win/Meta |

---

## Pointer Actions (`pointer` type)

Mouse pointer actions move the cursor and press/release mouse buttons.

### `pointerMove`

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

### `pointerDown` / `pointerUp`

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

### `pause`

Pauses the pointer action sequence for `duration` milliseconds.

---

## Wheel Actions (`wheel` type)

Scroll the mouse wheel at a position.

### `scroll`

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

---

## Null Actions (`none` type)

Used for timing/pause only.

```python
actions = ActionChains(driver)
actions.pause(500)  # wait 500ms
actions.perform()
```

---

## Full Example: Drag and Drop

```python
from selenium.webdriver.common.action_chains import ActionChains

source = driver.find_element(AppiumBy.NAME, "DragMe")
target = driver.find_element(AppiumBy.NAME, "DropHere")

ActionChains(driver).drag_and_drop(source, target).perform()
```

## Full Example: Right-Click Context Menu

```python
element = driver.find_element(AppiumBy.NAME, "File")
ActionChains(driver).context_click(element).perform()
```
