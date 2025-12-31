NovaWindows2 Driver
===================

NovaWindows2 Driver is a custom Appium driver designed to tackle the limitations of existing Windows automation solutions like WinAppDriver. It supports testing Universal Windows Platform (UWP), Windows Forms (WinForms), Windows Presentation Foundation (WPF), and Classic Windows (Win32) apps on Windows 10 and later.

Built to improve performance and reliability for traditional desktop applications, it offers:
- **Faster XPath locator performance** — Reduces element lookup times, even in complex UIs.
- **RawView element support** — Access elements typically hidden from the default ControlView/ContentView.
- **Enhanced text input handling** — Fast text entry with support for various keyboard layouts.
- **Platform-specific commands** — Supports direct window manipulation, advanced UI interactions, and more.
- **Seamless Setup** — Designed to work without Developer Mode or additional software.

---

## 📑 Table of Contents
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Example Usage](#-example-usage)
- [Key Features](#-key-features)
  - [Element Location](#element-location)
  - [Attribute Retrieval](#attribute-retrieval)
  - [PowerShell Execution](#powershell-execution)
- [Platform-Specific Extensions](#-platform-specific-extensions)
  - [Mouse & Pointer](#mouse--pointer)
  - [Keyboard](#keyboard)
  - [Element Operations](#element-operations)
  - [Selection Management](#selection-management)
  - [Window Management](#window-management)
  - [System & State](#system--state)
- [Development](#-development)

---

## 🚀 Getting Started

### Installation
The driver is built for Appium 3. To install it, run:
```bash
appium driver install --source=npm appium-novawindows2-driver
```

### Prerequisites
- **Host OS**: Windows 10 or later.
- No Developer Mode or extra dependencies required.

---

## ⚙️ Configuration

NovaWindows2 Driver supports the following capabilities:

| Capability Name | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `platformName` | Must be set to `Windows` (case-insensitive). | (Required) | `Windows` |
| `automationName` | Must be set to `NovaWindows2` (case-insensitive). | (Required) | `NovaWindows2` |
| `smoothPointerMove` | CSS-like easing function (including valid Bezier curve). This controls the smooth movement of the mouse for `delayBeforeClick` ms. | (None) | `ease-in`, `cubic-bezier(0.42, 0, 0.58, 1)` |
| `delayBeforeClick` | Time in milliseconds before a click is performed. | `0` | `500` |
| `delayAfterClick` | Time in milliseconds after a click is performed. | `0` | `500` |
| `appTopLevelWindow` | The handle of an existing application top-level window to attach to. It can be a number or string (not necessarily hexadecimal). | (None) | `12345`, `0x12345` |
| `shouldCloseApp` | Whether to close the window of the application in test after the session finishes. | `true` | `false` |
| `appArguments` | Optional string of arguments to pass to the app on launch. | (None) | `--debug` |
| `appWorkingDir` | Optional working directory path for the application. | (None) | `C:\Temp` |
| `prerun` | An object containing either `script` or `command` key. The value of each key must be a valid PowerShell script or command to be executed prior to the WinAppDriver session startup. See [Power Shell commands execution](#powershell-execution) for more details. | (None) | `{script: 'Get-Process outlook -ErrorAction SilentlyContinue'}` |
| `postrun` | An object containing either `script` or `command` key. The value of each key must be a valid PowerShell script or command to be executed after WinAppDriver session is stopped. See [Power Shell commands execution](#powershell-execution) for more details. | (None) | `{command: '...'}` |
| `isolatedScriptExecution` | Whether PowerShell scripts are executed in an isolated session. | `false` | `true` |
| `appWaitForLaunchRetries` | Number of retries when waiting for the app to launch. | `20` | `5` |
| `appWaitForLaunchRetryIntervalMs` | Interval (ms) between app launch check retries. | `500` | `500` |
| `powerShellCommandTimeout` | Timeout (ms) for PowerShell script execution. | `60000` | `30000` |
| `convertAbsoluteXPathToRelativeFromElement` | Convert absolute XPath to relative when searching from an element. | `true` | `true` |
| `includeContextElementInSearch` | Include the context element itself in the search. | `true` | `true` |
| `releaseModifierKeys` | Whether to release modifier keys after `sendKeys`. | `true` | `true` |

---

## 💡 Example Usage

Check out the [examples/refactor](examples/refactor) directory for comprehensive examples.

### Python (Appium-Python-Client)
```python
from appium import webdriver
from appium.options.windows import WindowsOptions

options = WindowsOptions()
options.app = 'C:\\Windows\\System32\\notepad.exe'
options.automation_name = 'NovaWindows2'

driver = webdriver.Remote('http://127.0.0.1:4723', options=options)
# ... tests ...
driver.quit()
```

---

## ✨ Key Features

### Element Location
Appium Windows Driver supports the same location strategies [the WinAppDriver supports](https://github.com/microsoft/WinAppDriver/blob/master/Docs/AuthoringTestScripts.md#supported-locators-to-find-ui-elements), but also includes Windows UIAutomation conditions:

| Name | Description | Example |
| :--- | :--- | :--- |
| `accessibility id` | This strategy is `AutomationId` attribute in inspect.exe | `CalculatorResults` |
| `class name` | This strategy is `ClassName` attribute in inspect.exe | `TextBlock` |
| `id` | This strategy is `RuntimeId` (decimal) attribute in inspect.exe | `42.333896.3.1` |
| `name` | This strategy is `Name` attribute in inspect.exe | `Calculator` |
| `tag name` | This strategy is `LocalizedControlType` (upper camel case) attribute in inspect.exe | `Text` |
| `xpath` | Custom XPath 1.0 queries on any attribute exposed by inspect.exe. | `(//Button)[2]` |
| `windows uiautomation` | UIAutomation conditions (C# or PowerShell syntax). | `new PropertyCondition(...)` |

### Attribute Retrieval
Retrieve comprehensive details about UI elements using standard or bulk methods.

- **Bulk Retrieval**: Use the `"all"` keyword to get 80+ properties in a single JSON object.
- **Dotted Names**: Access pattern-specific properties directly (e.g., `Window.CanMaximize`, `LegacyIAccessible.Name`).

```js
// getAttributes returns all properties as a JSON string
const allAttributes = await element.getAttribute("all");
```

### PowerShell Execution
Execute internal PowerShell scripts or commands directly from your test. This requires the `power_shell` insecure feature to be enabled on the Appium server.

It is possible to execute a single PowerShell command or a whole script. Note that `powerShell` is case-insensitive.

```javascript
// Execute a command string
await driver.executeScript('powerShell', { command: 'Get-Process Notepad' });

// Execute a script string
await driver.executeScript('powerShell', { script: '$p = Get-Process Notepad; $p.Kill();' });

// Shorthand (executes as command/script depending on context)
await driver.executeScript('powerShell', 'Get-Process');
```

---

## 🛠 Platform-Specific Extensions

All extensions are invoked via `driver.executeScript("windows: <methodName>", ...args)`.
Below are the detailed descriptions and arguments for each command.

> **Note**
> In most cases, commands can be used more intuitively by passing the element as the first argument (if required) and other parameters subsequently.

### Mouse & Pointer

#### `windows: click`
This is a shortcut for a single mouse click gesture.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `elementId` | `string` | no | Hexadecimal identifier of the element to click on. If this parameter is missing then given coordinates will be parsed as absolute ones. Otherwise they are parsed as relative to the top left corner of this element. | `123e4567-e89b...` |
| `x` | `number` | no | Integer horizontal coordinate of the click point. Both x and y coordinates must be provided or none of them if elementId is present. | `100` |
| `y` | `number` | no | Integer vertical coordinate of the click point. Both x and y coordinates must be provided or none of them if elementId is present. | `100` |
| `button` | `string` | no | Name of the mouse button to be clicked. Supported button names are: `left`, `middle`, `right`, `back`, `forward`. The default value is `left`. | `right` |
| `modifierKeys` | `string[]` \| `string` | no | List of possible keys or a single key name to depress while the click is being performed. Supported key names are: `Shift`, `Ctrl`, `Alt`, `Win`. | `['ctrl', 'alt']` |
| `durationMs` | `number` | no | The number of milliseconds to wait between pressing and releasing the mouse button. By default no delay is applied. | `500` |
| `times` | `number` | no | How many times the click must be performed. One by default. | `2` |
| `interClickDelayMs` | `number` | no | Duration of the pause between each click gesture. Only makes sense if `times` is greater than one. 100ms by default. | `10` |

#### Usage
```python
driver.execute_script('windows: click', {
    'elementId': element.id,
    'button': 'right',
    'times': 2,
    'modifierKeys': ['ctrl', 'alt']
})
```

#### `windows: scroll`
This is a shortcut for a mouse wheel scroll gesture. The API is a thin wrapper over the SendInput WinApi call.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `elementId` | `string` | no | Same as in `windows: click`. | `123e4567-e89b...` |
| `x` | `number` | no | Same as in `windows: click`. | `100` |
| `y` | `number` | no | Same as in `windows: click`. | `100` |
| `deltaX` | `number` | no | The amount of horizontal wheel movement measured in wheel clicks. Positive = right, Negative = left. | `-5` |
| `deltaY` | `number` | no | The amount of vertical wheel movement. Positive = forward (away), Negative = backward (toward). | `5` |
| `modifierKeys` | `string[]` \| `string` | no | Same as in `windows: click`. | `win` |

#### Usage
```python
driver.execute_script('windows: scroll', {
    'elementId': element.id,
    'deltaY': -5, # Scroll down 5 clicks
    'modifierKeys': 'shift'
})
```

#### `windows: hover`
This is a shortcut for a hover gesture.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `startElementId` | `string` | no | Same as in `windows: click`. | `123e4567-e89b...` |
| `startX` | `number` | no | Same as in `windows: click`. | `100` |
| `startY` | `number` | no | Same as in `windows: click`. | `100` |
| `endElementId` | `string` | no | Same as in `windows: click`. | `123e4567-e89b...` |
| `endX` | `number` | no | Same as in `windows: click`. | `200` |
| `endY` | `number` | no | Same as in `windows: click`. | `200` |
| `modifierKeys` | `string[]` \| `string` | no | Same as in `windows: click`. | `shift` |
| `durationMs` | `number` | no | The number of milliseconds between moving the cursor from the starting to the ending hover point. 500ms by default. | `700` |

#### Usage
```python
driver.execute_script('windows: hover', {
    'startElementId': element1.id,
    'endElementId': element2.id,
    'durationMs': 1000
})
```

### Keyboard

#### `windows: keys`
This is a shortcut for a customized keyboard input. Selenium keys should also work as modifier keys.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `actions` | `KeyAction[]` \| `KeyAction` | yes | One or more KeyAction dictionaries. | `[{'virtualKeyCode': 0x10, 'down': true}]` |
| `forceUnicode` | `boolean` | no | Forces the characters to be sent as unicode characters. | `true` |

##### KeyAction Dictionary

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `pause` | `number` | no | Allows to set a delay in milliseconds between key input series. | `100` |
| `text` | `string` | no | Non-empty string of Unicode text to type. | `Hello` |
| `virtualKeyCode` | `number` | no | Valid virtual key code. | `0x10` |
| `down` | `boolean` | no | If set to `true` then the corresponding key will be depressed, `false` - released. | `true` |

#### Usage
```python
driver.execute_script('windows: keys', {
    'actions': [
        {'virtualKeyCode': 0x10, 'down': True}, # Shift Down
        {'text': 'Hello World'},
        {'virtualKeyCode': 0x10, 'down': False} # Shift Up
    ]
})
```

### System & State

#### `windows: setClipboard`
Sets Windows clipboard content to the given text or a PNG image.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `b64Content` | `string` | yes | Base64-encoded content of the clipboard to be set. | `QXBwaXVt` |
| `contentType` | `string` | no | Set to `plaintext` (default) or `image`. | `image` |

#### Usage
```python
driver.execute_script('windows: setClipboard', {
    'b64Content': 'SGVsbG8=', # "Hello" in Base64
    'contentType': 'plaintext'
})
```

#### `windows: getClipboard`
Retrieves Windows clipboard content.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `contentType` | `string` | no | Set to `plaintext` (default) or `image`. | `image` |

#### Usage
```python
content = driver.execute_script('windows: getClipboard', {
    'contentType': 'plaintext'
})
print(content)
```

#### `windows: pushCacheRequest`
This is an asynchronous function that sends cache requests based on specific conditions.

| Name | Type | Required | Description | Example |
| :--- | :--- | :--- | :--- | :--- |
| `treeFilter` | `string` | yes | Defines the filter that is applied when walking the automation tree. | `RawView` |
| `treeScope` | `string` | no | Defines the scope of the automation tree to be cached. | `SubTree` |
| `automationElementMode` | `string` | no | Specifies the mode of automation element (e.g., `None`, `Full`). | `Full` |

#### Usage
```python
driver.execute_script('windows: pushCacheRequest', {
    'treeFilter': 'RawView',
    'treeScope': 'SubTree'
})
```

### Element Operations

#### `windows: invoke`
Invokes a UI element pattern, simulating an interaction like clicking or activating the element.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element on which the `InvokePattern` is called. | `element` |

#### Usage
```python
driver.execute_script('windows: invoke', element)
```

#### `windows: expand`
Expands a UI element that supports the `ExpandPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to expand. | `element` |

#### Usage
```python
driver.execute_script('windows: expand', element)
```

#### `windows: collapse`
Collapses a UI element that supports the `CollapsePattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to collapse. | `element` |

#### Usage
```python
driver.execute_script('windows: collapse', element)
```

#### `windows: setValue`
Sets the value of a UI element using the `ValuePattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element whose value will be set. | `element` |
| 2 | `string` | The value to be set. | `"new value"` |

#### Usage
```python
driver.execute_script('windows: setValue', element, 'New Value')
```

#### `windows: getValue`
Gets the current value of a UI element that supports the `ValuePattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element from which to retrieve the value. | `element` |

#### Usage
```python
value = driver.execute_script('windows: getValue', element)
```

#### `windows: scrollIntoView`
Scrolls the UI element into view using the `ScrollItemPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to bring into view. | `element` |

#### Usage
```python
driver.execute_script('windows: scrollIntoView', element)
```

#### `windows: toggle`
Toggles a UI element’s state using the `TogglePattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to toggle. | `element` |

#### Usage
```python
driver.execute_script('windows: toggle', element)
```

### Selection Management

#### `windows: select`
Selects a UI element using the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to select. | `element` |

#### Usage
```python
driver.execute_script('windows: select', element)
```

#### `windows: addToSelection`
Adds an element to the current selection on a UI element that supports the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to add to the selection. | `element` |

#### Usage
```python
driver.execute_script('windows: addToSelection', element)
```

#### `windows: removeFromSelection`
Removes an element from the current selection on a UI element that supports the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to remove from the selection. | `element` |

#### Usage
```python
driver.execute_script('windows: removeFromSelection', element)
```

#### `windows: isMultiple`
Checks if a UI element supports multiple selection using the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to check. | `element` |

#### Usage
```python
is_multi = driver.execute_script('windows: isMultiple', element)
```

#### `windows: selectedItem`
Gets the selected item from a UI element that supports the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element from which to retrieve the selected item. | `element` |

#### Usage
```python
selected_el = driver.execute_script('windows: selectedItem', element)
```

#### `windows: allSelectedItems`
Gets all selected items from a UI element that supports the `SelectionPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element from which to retrieve all selected items. | `element` |

#### Usage
```python
selected_els = driver.execute_script('windows: allSelectedItems', element)
```

### Window Management

#### `windows: maximize`
Maximizes a window or UI element using the `WindowPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The window or UI element to maximize. | `element` |

#### Usage
```python
driver.execute_script('windows: maximize', element)
```

#### `windows: minimize`
Minimizes a window or UI element using the `WindowPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The window or UI element to minimize. | `element` |

#### Usage
```python
driver.execute_script('windows: minimize', element)
```

#### `windows: restore`
Restores a window or UI element to its normal state using the `WindowPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The window or UI element to restore. | `element` |

#### Usage
```python
driver.execute_script('windows: restore', element)
```

#### `windows: close`
Closes a window or UI element using the `WindowPattern`.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The window or UI element to close. | `element` |

#### Usage
```python
driver.execute_script('windows: close', element)
```

#### `windows: setFocus`
Sets focus to the specified UI element using UIAutomationElement's `SetFocus` method.

| Position | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| 1 | `Element` | The UI element to set focus on. | `element` |

#### Usage
```python
driver.execute_script('windows: setFocus', element)
```

---

## 🛠 Development

Recommended VS Code plugin: [Comment tagged templates](https://marketplace.visualstudio.com/items?itemName=bierner.comment-tagged-templates) for syntax highlighting.

```bash
npm install        # Setup dependencies
npm run lint       # Code quality check
npm run build      # Transpile TypeScript to JS
```
