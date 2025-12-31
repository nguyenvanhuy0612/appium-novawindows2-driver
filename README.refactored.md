NovaWindows2 Driver
===================

NovaWindows2 Driver is a custom Appium driver designed to tackle the limitations of existing Windows automation solutions like WinAppDriver. It supports testing Universal Windows Platform (UWP), Windows Forms (WinForms), Windows Presentation Foundation (WPF), and Classic Windows (Win32) apps on Windows 10 and later.

Built to improve performance and reliability for traditional desktop applications, it offers:
- **Faster XPath locator performance** — Reduces element lookup times, even in complex UIs.
- **RawView element support** — Access elements typically hidden from the default ControlView/ContentView.
- **Enhanced text input handling** — Solves keyboard layout issues while improving input speed.
- **Platform-specific commands** — Supports direct window manipulation, advanced UI interactions, and more.
- **Seamless Setup** — Designed to work without Developer Mode or additional software.

---

## 📑 Table of Contents
- [Getting Started](#-getting-started)
- [Configuration](#-configuration)
- [Example Usage](#-example-usage)
- [Key Features](#-key-features)
  - [Attribute Retrieval](#attribute-retrieval)
  - [Element Location](#element-location)
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
The driver is built for Appium 2/3. To install it, run:
```bash
appium driver install --source=npm appium-novawindows2-driver
```

### Prerequisites
- **Host OS**: Windows 10 or later.
- No Developer Mode or extra dependencies required.

---

## ⚙️ Configuration

NovaWindows2 Driver supports the following capabilities:

| Capability Name | Description | Example |
| :--- | :--- | :--- |
| `platformName` | Must be set to `Windows` (case-insensitive). | `Windows` |
| `automationName` | Must be set to `NovaWindows2` (case-insensitive). | `NovaWindows2` |
| `smoothPointerMove` | CSS-like easing function for mouse movement. | `ease-in`, `cubic-bezier(...)` |
| `delayBeforeClick` | Time (ms) before a click is performed. | `500` |
| `delayAfterClick` | Time (ms) after a click is performed. | `500` |
| `appTopLevelWindow` | Handle of an existing top-level window (dec or hex). | `12345`, `0x12345` |
| `shouldCloseApp` | Whether to close the app after the session. Default: `true`. | `false` |
| `appArguments` | Arguments to pass to the app on launch. | `--debug` |
| `appWorkingDir` | Working directory for the application. | `C:\Temp` |
| `prerun` | PowerShell script/command to run before session start. | `{script: '...'}` |
| `postrun` | PowerShell script/command to run after session stop. | `{command: '...'}` |
| `isolatedScriptExecution` | Execute scripts in an isolated session. Default: `false`. | `true` |

---

## 💡 Example Usage

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

### Attribute Retrieval
Retrieve comprehensive details about UI elements using standard or bulk methods.

- **Bulk Retrieval**: Use the `"all"` keyword to get 80+ properties in a single JSON object.
- **Dotted Names**: Access pattern-specific properties directly (e.g., `Window.CanMaximize`, `LegacyIAccessible.Name`).

```js
// getAttributes returns all properties as a JSON string
const allAttributes = await element.getAttribute("all");
```

### Element Location
Supports standard strategies plus advanced UIAutomation conditions.

| Name | Description | Example |
| :--- | :--- | :--- |
| `accessibility id` | Mapping to `AutomationId` in Inspect.exe. | `CalculatorResults` |
| `class name` | Mapping to `ClassName` in Inspect.exe. | `TextBlock` |
| `id` | Mapping to `RuntimeId` (decimal). | `42.333896.3.1` |
| `name` | Mapping to `Name` attribute. | `Calculator` |
| `xpath` | Custom XPath 1.0 queries. | `(//Button)[2]` |
| `windows uiautomation` | UIAutomation conditions (C# or PowerShell syntax). | `new PropertyCondition(...)` |

### PowerShell Execution
Execute internal PowerShell scripts or commands directly from your test. This requires the `power_shell` insecure feature to be enabled on the Appium server.

```java
// Java example
driver.executeScript("powerShell", "$p = Get-Process Notepad; $p.Kill();");
```

---

## 🛠 Platform-Specific Extensions

All extensions are invoked via `driver.executeScript("windows: <methodName>", ...args)`.

### Mouse & Pointer
| Command | Description |
| :--- | :--- |
| `windows: click` | Performs a mouse click with customizable button, coordinates, and modifiers. |
| `windows: scroll` | Thin wrapper over `SendInput` for mouse wheel gestures. |
| `windows: hover` | Performs a smooth hover gesture between two points. |

### Keyboard
| Command | Description |
| :--- | :--- |
| `windows: keys` | Advanced keyboard input supporting virtual key codes and unicode text. |

### Element Operations
| Command | Description |
| :--- | :--- |
| `windows: invoke` | Calls `InvokePattern` on the element. |
| `windows: expand` / `collapse` | Expands or collapses elements (trees, combo boxes, etc.). |
| `windows: setValue` / `getValue` | Sets or gets values using `ValuePattern`. |
| `windows: toggle` | Toggles state (checkboxes, radio buttons). |
| `windows: scrollIntoView` | Scrolls the element into its container's view. |

### Selection Management
| Command | Description |
| :--- | :--- |
| `windows: select` | Selects an element. |
| `windows: addToSelection` | Adds to existing selection. |
| `windows: removeFromSelection` | Removes from selection. |
| `windows: isMultiple` | Checks for multiple selection support. |
| `windows: selectedItem` | Retrieves the currently selected item. |

### Window Management
| Command | Description |
| :--- | :--- |
| `windows: maximize` / `minimize` | Changes window state. |
| `windows: restore` | Restores window to normal state. |
| `windows: close` | Closes the window. |
| `windows: setFocus` | Sets input focus to the element. |

### System & State
| Command | Description |
| :--- | :--- |
| `windows: getAttributes` | Bulk retrieval of all element properties. |
| `windows: setClipboard` / `getClipboard` | Manages Windows clipboard (supports text and images). |
| `windows: pushCacheRequest` | Defines UIA cache requests for performance. |

---

## 🛠 Development

Recommended VS Code plugin: [Comment tagged templates](https://marketplace.visualstudio.com/items?itemName=bierner.comment-tagged-templates) for syntax highlighting.

```bash
npm install        # Setup dependencies
npm run lint       # Code quality check
npm run build      # Transpile TypeScript to JS
```
