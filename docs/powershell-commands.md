# PowerShell Commands

The driver exposes direct access to its persistent **PowerShell session**, allowing you to execute arbitrary PowerShell scripts within the same process that handles all UIA operations.

> ⚠️ **Security note:** Executing arbitrary PowerShell is a privileged operation. Enable this feature only when needed using the `POWER_SHELL` feature flag (see Appium featuresList configuration).

---

## `execute('powershell', args)`

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

### Shared Session vs. Isolated Session

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

---

## `sendPowerShellCommand(command)` *(internal)*

The internal command-queue-based method that all driver commands use under the hood. Commands are queued and executed sequentially to prevent race conditions in the persistent session.

- Writes the command to the PowerShell stdin.
- Appends a sentinel marker (`___NOVA_WIN2_DRIVER_END___`) to detect output completion.
- Respects the `powerShellCommandTimeout` capability (default: 60 000 ms).
- On timeout, forcefully kills the PowerShell process tree using `taskkill /F /T`.

---

## `sendIsolatedPowerShellCommand(command)` *(internal)*

Spawns a standalone `powershell.exe -NoProfile -Command <command>` process, waits for it to exit, and returns stdout.

Used when `isolatedScriptExecution` is `true`.

---

## Session Management

### `startPowerShellSession()`

Called automatically during `createSession`. Handles:

1. Spawning the persistent `powershell.exe -NoProfile -NoExit -Command -` process.
2. Setting UTF-8 encoding.
3. Loading required .NET assemblies: `UIAutomationClient`, `System.Drawing`, `PresentationCore`, `System.Windows.Forms`.
4. Initialising the `CacheRequest`, element table, and PowerShell helper functions (`Get-PageSource`, `Find-ChildrenRecursively`, MSAA helpers, etc.).
5. Setting the **root element** based on capabilities (`app`, `appTopLevelWindow`).

### `terminatePowerShellSession()`

Called automatically during `deleteSession`. Closes stdin to trigger a graceful exit, with a 5-second timeout before `SIGKILL`.

---

## Available PowerShell Variables & Functions

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

### Using `$rootElement` and `$elementTable`

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

---

## Error Handling

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
