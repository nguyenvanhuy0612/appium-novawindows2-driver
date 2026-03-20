# Finding Elements

The driver supports the following element locator strategies.

## Supported Strategies

| Strategy | Appium/WebDriver ID | Description |
|---|---|---|
| [ID](#id) | `id` | UI Automation Runtime ID |
| [Name](#name) | `name` | Element `Name` property |
| [XPath](#xpath) | `xpath` | XPath expression evaluated against the UI tree |
| [Tag Name](#tag-name) | `tag name` | UIA Control Type (e.g. `Button`, `Edit`) |
| [Class Name](#class-name) | `class name` | `ClassName` property |
| [Accessibility ID](#accessibility-id) | `accessibility id` | UIA `AutomationId` property |
| [Windows UIAutomation](#windows-uiautomation) | `-windows uiautomation` | Raw UIA condition string |

---

## ID

Matches elements by their **Runtime ID** — a dot-separated integer array uniquely identifying an element in the current session (e.g. `"42.1234.1.1"`).

> **Note:** Runtime IDs are session-scoped and may change between runs.

```python
element = driver.find_element(AppiumBy.ID, "42.1234.1.1")
```

---

## Name

Matches elements whose `Name` property equals the given string.

```python
element = driver.find_element(AppiumBy.NAME, "Save")
```

---

## XPath

Full XPath 1.0 support evaluated against the UIA element tree. Tag names correspond to Control Types (`Button`, `Edit`, `Window`, etc.).

**Available attributes in XPath:**
- `Name`, `AutomationId`, `ClassName`, `ControlType`
- `IsEnabled`, `IsOffscreen`, `IsPassword`, `HasKeyboardFocus`
- `ProcessId`, `RuntimeId`, `FrameworkId`
- `AcceleratorKey`, `AccessKey`, `HelpText`, `ItemStatus`, `ItemType`

**Examples:**

```python
# By name
element = driver.find_element(AppiumBy.XPATH, "//Button[@Name='OK']")

# By automation ID
element = driver.find_element(AppiumBy.XPATH, "//*[@AutomationId='textBox1']")

# Contains text
elements = driver.find_elements(AppiumBy.XPATH, "//ListItem[contains(@Name, 'file')]")

# Starts-with
elements = driver.find_elements(AppiumBy.XPATH, "//Edit[starts-with(@Name, 'Search')]")

# By control type
elements = driver.find_elements(AppiumBy.XPATH, "//Button")

# Nested path
element = driver.find_element(AppiumBy.XPATH, "//Window[@Name='Notepad']//Edit")
```

### Searching From an Element Context

When calling `find_element` from an existing element, absolute XPaths (`/...`) are automatically converted to relative (`./...`) if the `convertAbsoluteXPathToRelativeFromElement` capability is `true` (default).

```python
window = driver.find_element(AppiumBy.XPATH, "//Window[@Name='Notepad']")
edit   = window.find_element(AppiumBy.XPATH, "//Edit")  # becomes .//Edit automatically
```

---

## Tag Name

Matches elements by their UIA **Control Type** name.

> **Aliases:** `list` also matches `DataGrid`; `listitem` also matches `DataItem`.

```python
buttons  = driver.find_elements(AppiumBy.TAG_NAME, "Button")
edit     = driver.find_element(AppiumBy.TAG_NAME, "Edit")
listview = driver.find_element(AppiumBy.TAG_NAME, "List")
```

Full list of common control types: `Button`, `Calendar`, `CheckBox`, `ComboBox`, `Custom`, `DataGrid`, `DataItem`, `Document`, `Edit`, `Group`, `Header`, `HeaderItem`, `Hyperlink`, `Image`, `List`, `ListItem`, `Menu`, `MenuBar`, `MenuItem`, `Pane`, `ProgressBar`, `RadioButton`, `ScrollBar`, `SemanticZoom`, `Separator`, `Slider`, `Spinner`, `SplitButton`, `StatusBar`, `Tab`, `TabItem`, `Table`, `Text`, `Thumb`, `TitleBar`, `ToolBar`, `ToolTip`, `Tree`, `TreeItem`, `Window`.

---

## Class Name

Matches elements by their `ClassName` property (the Win32 window class name).

```python
element = driver.find_element(AppiumBy.CLASS_NAME, "Edit")
element = driver.find_element(AppiumBy.CLASS_NAME, "RICHEDIT50W")
```

---

## Accessibility ID

Matches elements by their UIA **AutomationId** property.

```python
element = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "textBox1")
```

---

## Windows UIAutomation

A custom condition string that maps to a UIA `Condition` object. Useful for complex conditions that cannot be expressed as XPath.

The format accepts property conditions using the UIA property name and value:

```python
element = driver.find_element("-windows uiautomation", "Name=OK")
element = driver.find_element("-windows uiautomation", "AutomationId=btnSave")
```

---

## Tips

- Prefer **`accessibility id`** (AutomationId) or **`id`** (RuntimeId) for the fastest lookups.
- Use **XPath** for complex conditions or hierarchical searches.
- Use **`getPageSource()`** or `windows: getAttributes` to inspect the UIA tree and find the right selector.
