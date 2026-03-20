# App Commands

Commands for managing the application, windows, and page-level information.

---

## `getPageSource()`

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

---

## `getScreenshot()`

Takes a full screenshot of the application window (or the entire desktop if `app=root`) and returns it as a base64-encoded PNG.

If a specific app is targeted (not `root`), this command attempts to bring the window to the foreground first via `SetForegroundWindow`.

```python
png_b64 = driver.get_screenshot_as_base64()
# or save to file:
driver.save_screenshot("screenshot.png")
```

---

## `getWindowRect()`

Returns the bounding rectangle of the current root (application) window in **screen coordinates**.

**Returns:** `{ x, y, width, height }` (all integers in pixels)

```python
rect = driver.get_window_rect()
print(rect)  # { 'x': 0, 'y': 0, 'width': 1920, 'height': 1080 }
```

---

## `getWindowHandle()`

Returns the native Win32 window handle of the current root element as a zero-padded 8-character hex string (e.g. `"0x00010ABC"`).

```python
handle = driver.current_window_handle
print(handle)  # "0x00010ABC"
```

---

## `getWindowHandles()`

Returns a list of native window handles for all **top-level windows** currently on the desktop (children of the desktop root element).

Each handle is formatted as an 8-character zero-padded hex string.

```python
handles = driver.window_handles
for handle in handles:
    print(handle)
```

---

## `setWindow(nameOrHandle)`

Switches to a window by its **native handle** (as a number in decimal/hex string) or by its **Name** property.

The driver retries up to 20 times with 500 ms sleep between retries (useful for windows that are still starting up). Calling `SetForegroundWindow` is also attempted.

Throws `NoSuchWindowError` if the window is not found after all retries.

```python
# Switch by handle (hex string accepted by WebDriver)
driver.switch_to.window("0x00010ABC")

# Switch by window name
driver.switch_to.window("Notepad")
```

---

## `changeRootElement(pathOrNativeWindowHandle)`

**Extension command** — changes the UIA search root to a different window. Used internally by the driver during session creation or when switching windows.

| Overload | Description |
|---|---|
| `changeRootElement(nativeWindowHandle: number)` | Switch root to the window matching an integer native window handle |
| `changeRootElement(path: string)` | Launch an app and wait for its window to appear, then switch root to it. Supports UWP app IDs and classic `.exe` paths |

This command is called automatically when `setWindow` is used, but can also be invoked via PowerShell scripts.

---

## `attachToApplicationWindow(processIds, attemptNumber?)`

**Internal command** — attempts to attach the root element to the main window belonging to one of the given process IDs. Called by `changeRootElement` after launching an app.

- Iterates process IDs in priority order (newest process first for the first 6 attempts).
- Tries `SetForegroundWindow` and then UIA `SetFocus` to bring the window to the front.
- Throws `UnknownError` if no matching window is found.

> This is an internal command and is not typically called directly.
