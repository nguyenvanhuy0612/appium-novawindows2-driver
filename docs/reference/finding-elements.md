# Finding Elements

How to locate elements in the UIA tree, what each strategy compiles to, and how to make finds fast on enterprise UIs.

- [Supported Strategies](#supported-strategies)
- [Per-strategy reference](#per-strategy-reference)
- [The `-windows uiautomation` selector DSL](#the--windows-uiautomation-selector-dsl)
- [Tree views — RawView vs ControlView vs ContentView](#tree-views--rawview-vs-controlview-vs-contentview)
- [Searching from an element context](#searching-from-an-element-context)
- [XPath performance](#xpath-performance)
- [Cookbook — common patterns](#cookbook--common-patterns)
- ["Why can't I find this element?" — troubleshooting](#why-cant-i-find-this-element--troubleshooting)

---

## Supported Strategies

| Strategy | Appium/WebDriver ID | Description |
|---|---|---|
| [ID](#id) | `id` | UI Automation Runtime ID |
| [Name](#name) | `name` | Element `Name` property |
| [XPath](#xpath) | `xpath` | XPath expression evaluated against the UI tree |
| [Tag Name](#tag-name) | `tag name` | UIA Control Type (e.g. `Button`, `Edit`) |
| [Class Name](#class-name) | `class name` | `ClassName` property |
| [Accessibility ID](#accessibility-id) | `accessibility id` | UIA `AutomationId` property |
| [Windows UIAutomation](#the--windows-uiautomation-selector-dsl) | `-windows uiautomation` | Raw UIA condition string (DSL) |

A CSS-selector compatibility shim in `processSelector()` silently rewrites `.class`, `#id`, and `*[name="…"]` to the appropriate native strategy (with a warning logged).

## Per-strategy reference

### ID

Matches elements by their **Runtime ID** — a dot-separated integer string uniquely identifying an element in the current session (e.g. `"42.1234.1.1"`).

> **Note:** Runtime IDs are session-scoped and may change between runs. They're returned to the test as the W3C `element-6066-11e4-a52e-4f735466cecf` value. Don't store them across sessions.

```python
element = driver.find_element(AppiumBy.ID, "42.1234.1.1")
```

### Name

Matches elements whose `Name` property equals the given string.

```python
element = driver.find_element(AppiumBy.NAME, "Save")
```

### XPath

Full XPath 1.0 support evaluated against the UIA element tree. Tag names correspond to Control Types (`Button`, `Edit`, `Window`, etc.).

**Available attributes in XPath:**

- `Name`, `AutomationId`, `ClassName`, `ControlType`, `LocalizedControlType`
- `IsEnabled`, `IsOffscreen`, `IsPassword`, `HasKeyboardFocus`, `IsContentElement`, `IsControlElement`, `IsRequiredForForm`
- `ProcessId`, `RuntimeId`, `FrameworkId`
- `AcceleratorKey`, `AccessKey`, `HelpText`, `ItemStatus`, `ItemType`
- `Orientation`
- Bounding rect (computed): `x`, `y`, `width`, `height`

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

# Multiple predicates
element = driver.find_element(AppiumBy.XPATH, "//Button[@Name='OK' and @IsEnabled='true']")

# Position-based
first_button = driver.find_element(AppiumBy.XPATH, "//Button[1]")
last_item = driver.find_element(AppiumBy.XPATH, "(//ListItem)[last()]")
```

### Tag Name

Matches elements by their UIA **Control Type** name.

> **Aliases:** `list` also matches `DataGrid`; `listitem` also matches `DataItem`.

```python
buttons  = driver.find_elements(AppiumBy.TAG_NAME, "Button")
edit     = driver.find_element(AppiumBy.TAG_NAME, "Edit")
listview = driver.find_element(AppiumBy.TAG_NAME, "List")
```

Full list of common control types: `Button`, `Calendar`, `CheckBox`, `ComboBox`, `Custom`, `DataGrid`, `DataItem`, `Document`, `Edit`, `Group`, `Header`, `HeaderItem`, `Hyperlink`, `Image`, `List`, `ListItem`, `Menu`, `MenuBar`, `MenuItem`, `Pane`, `ProgressBar`, `RadioButton`, `ScrollBar`, `SemanticZoom`, `Separator`, `Slider`, `Spinner`, `SplitButton`, `StatusBar`, `Tab`, `TabItem`, `Table`, `Text`, `Thumb`, `TitleBar`, `ToolBar`, `ToolTip`, `Tree`, `TreeItem`, `Window`.

### Class Name

Matches elements by their `ClassName` property (the Win32 window class name).

```python
element = driver.find_element(AppiumBy.CLASS_NAME, "Edit")
element = driver.find_element(AppiumBy.CLASS_NAME, "RICHEDIT50W")
```

### Accessibility ID

Matches elements by their UIA **AutomationId** property. Generally the **fastest and most stable** locator strategy when the property is set.

```python
element = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "textBox1")
```

---

## The `-windows uiautomation` selector DSL

A custom condition string that maps directly to a UIA `Condition` object. Use it for cases that XPath can't express well (ranges, point-in-rect tests, `Or` of multiple distinct properties) or where you want maximum performance — there's no XPath parser overhead, just regex-driven DSL parsing.

### Syntax — by example

```python
# Property equality (most common form — implicit PropertyCondition)
driver.find_element("-windows uiautomation", "Name=OK")
driver.find_element("-windows uiautomation", "AutomationId=btnSave")
driver.find_element("-windows uiautomation", "IsEnabled=true")

# Explicit constructor form
driver.find_element("-windows uiautomation",
    "System.Windows.Automation.PropertyCondition(System.Windows.Automation.AutomationElement.NameProperty, 'OK')")
```

### Logical combinators

```python
# AND — all sub-conditions must match
driver.find_element("-windows uiautomation",
    "System.Windows.Automation.AndCondition(Name='OK', IsEnabled=true)")

# OR — any sub-condition matches
driver.find_element("-windows uiautomation",
    "System.Windows.Automation.OrCondition(Name='OK', Name='Yes')")

# NOT — invert
driver.find_element("-windows uiautomation",
    "System.Windows.Automation.NotCondition(IsOffscreen=true)")

# Nested combinators
driver.find_element("-windows uiautomation",
    "And(Or(Name='OK', Name='Yes'), IsEnabled=true)")
```

### Built-in singletons

```
System.Windows.Automation.Condition.TrueCondition       # always-match
System.Windows.Automation.Condition.FalseCondition      # never-match
System.Windows.Automation.Automation.RawViewCondition   # all elements
System.Windows.Automation.Automation.ControlViewCondition   # control elements only (default)
System.Windows.Automation.Automation.ContentViewCondition   # content elements only
```

### Value types

The DSL parser accepts several literal forms:

| Type | Examples |
|---|---|
| Boolean | `true`, `false`, `$true`, `$false` |
| Integer | `42`, `-7` |
| Float | `1.5`, `-0.25` |
| String (single-quoted) | `'OK'`, `'Hello, World'`, `'It''s a trap'` (`''` to embed a quote) |
| String (double-quoted) | `"OK"`, `"backtick `escape: `n"` (PS-style backtick escapes) |
| Control type | `Button`, `Edit`, or fully-qualified `[System.Windows.Automation.ControlType]::Button` |
| Point | `Point(10, 20)`, `[System.Windows.Point]::new(10, 20)` |
| Rect (4-arg) | `Rect(0, 0, 100, 50)` |
| Rect (point + size) | `Rect(Point(0,0), Size(100, 50))` |
| Rect (two points) | `Rect(Point(0,0), Point(100, 50))` |
| Int array | `@(1, 2, 3)`, `[int32[]]@(1, 2, 3)` |
| Culture | `[CultureInfo]::new('en-US')`, `[CultureInfo]::new(1033)` |

Property names accept the short form (`Name`, `AutomationId`, `IsEnabled`) — the parser auto-prefixes `System.Windows.Automation.AutomationElement` and appends `Property`.

### When to prefer the DSL over XPath

| Use the DSL when | Use XPath when |
|---|---|
| You're matching a single element by 1–3 properties | You need axes (`ancestor::`, `following-sibling::`, etc.) |
| You want maximum lookup speed | You need string functions (`contains`, `starts-with`, `substring`) |
| You're writing a custom finder helper that's reused many times | You're working ad-hoc / one-off in a test |
| The condition is a tight `And` / `Or` / `Not` tree | You need positional / hierarchical traversal |

The DSL is implemented in [`lib/powershell/converter.ts`](../../lib/powershell/converter.ts).

---

## Tree views — RawView vs ControlView vs ContentView

UIA exposes three different "views" of the element tree. They're not different trees — they're different filters over the same tree.

| View | Includes | Default? |
|---|---|---|
| **RawView** | Every UIA element — including framework-internal panes, decorative containers, accessibility-irrelevant elements | No |
| **ControlView** | Elements where `IsControlElement = true` — typical interactive controls + structural containers | **Yes** (default for find operations) |
| **ContentView** | Elements where `IsContentElement = true` — narrowest view, only "content" elements | No |

**For enterprise apps** with custom controls, the element you need is often filtered out by `ControlView`. Symptoms:

- `getPageSource()` shows the element. `findElement` says it doesn't exist.
- Accessibility Insights / Inspect.exe shows the element in `RawView` but not in `ControlView`.

**Fix**: switch the driver's `CacheRequest` to `RawView` via `windows: cacheRequest`:

```python
driver.execute_script("windows: cacheRequest", [{
    "treeFilter": "System.Windows.Automation.Automation.RawViewCondition"
}])
# Subsequent finds traverse RawView
```

Other `cacheRequest` knobs:

```python
driver.execute_script("windows: cacheRequest", [{
    "treeScope": "Subtree",          # or "Children", "Descendants", "Element"
    "treeFilter": "System.Windows.Automation.Automation.RawViewCondition",
    "automationElementMode": "Full"  # or "None" — "None" is faster but has limited info
}])
```

> The `cacheRequest` setting is session-scoped. After a PS auto-restart it resets to default (`ControlView`); explicit overrides need to be re-issued.

See [Extensions → cacheRequest](./extensions.md#cacherequest).

---

## Searching from an element context

When calling `find_element` from an existing element, absolute XPaths (`/...`) are automatically converted to relative (`./...`) if the `convertAbsoluteXPathToRelativeFromElement` capability is `true` (default).

```python
window = driver.find_element(AppiumBy.XPATH, "//Window[@Name='Notepad']")
edit   = window.find_element(AppiumBy.XPATH, "//Edit")  # becomes .//Edit automatically
```

Without this rewrite, `window.find_element('xpath', '//Edit')` would search from the document root, not from `window`. The auto-rewrite makes element-scoped finds work intuitively.

The element context itself is included in the search by default (`appium:includeContextElementInSearch = true`). Set to `false` to exclude.

---

## XPath performance

The XPath engine pushes common predicates into the PowerShell side instead of evaluating in JS after enumerating the tree. The difference between a 50 ms find and a 5-second find on a large list.

### What's pushed down

These XPath constructs become PS-side filters (`Where-Object { ... }`), so PS only returns matches — Node never sees the rejected elements:

- `[@AttrName=value]` — direct property comparison
- `[contains(@AttrName, value)]` — `like '*value*'`
- `[starts-with(@AttrName, value)]` — `like 'value*'`

### What runs in JS

These need full enumeration to JS first:

- Position predicates: `[1]`, `[last()]`, `[last() - 1]`
- Other XPath functions: `substring`, `string-length`, `normalize-space`, `translate`, `count`, `sum`, etc.
- Predicates that mix position with property tests (`[1][contains(...)]` evaluates position FIRST per spec, then `contains` in JS)

### Practical guidance

1. **Filter before counting**: `(//ListItem[@Name='Invoice'])[1]` is faster than `(//ListItem)[1][@Name='Invoice']` because the first form pushes `@Name='Invoice'` to PS; the second enumerates all ListItems first.
2. **Prefer `accessibility id` > `name` > `xpath` w/ properties > deep `xpath`**.
3. **Anchor XPath at a window when possible**: `//Window[@AutomationId='Main']//Button[@Name='OK']` is much faster than `//Button[@Name='OK']` on a desktop with many windows.
4. **Avoid `//*` traversals on large trees** — every UIA element gets enumerated. If you need a generic search, narrow the control type: `//Button[contains(@Name, 'OK')]`.
5. **Use `windows: cacheRequest`** with a tree filter when doing many finds against a stable subtree — the filter persists across calls.

---

## Cookbook — common patterns

### Find by accessibility id (preferred when stable)

```python
btn = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "btnSave")
```

### Find by name with localization tolerance

```python
# Falls back to LocalizedControlType
btn = driver.find_element(AppiumBy.XPATH, "//*[@LocalizedControlType='button' and @Name='OK']")
```

### Wait for a window to appear

```python
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from appium.webdriver.common.appiumby import AppiumBy

WebDriverWait(driver, 30).until(
    EC.presence_of_element_located((AppiumBy.XPATH, "//Window[@Name='Login']"))
)
```

### Find a button inside a specific dialog

```python
dialog = driver.find_element(AppiumBy.XPATH, "//Window[@AutomationId='LoginDialog']")
ok_btn = dialog.find_element(AppiumBy.NAME, "OK")
```

### Check a checkbox by name

```python
cb = driver.find_element(AppiumBy.XPATH, "//CheckBox[@Name='Remember me']")
state = driver.get_property(cb, "Toggle.ToggleState")  # "Off", "On", "Indeterminate"
if state == "Off":
    driver.execute_script("windows: toggle", [cb])
```

### Find all rows in a list, iterate

```python
rows = driver.find_elements(AppiumBy.XPATH, "//List[@AutomationId='Items']/ListItem")
for row in rows:
    name = driver.get_property(row, "Name")
    print(f"row: {name}")
```

### Find a hidden / off-screen element (RawView)

```python
driver.execute_script("windows: cacheRequest", [{
    "treeFilter": "System.Windows.Automation.Automation.RawViewCondition"
}])
hidden = driver.find_element(AppiumBy.XPATH, "//Pane[@AutomationId='AdvancedOptions']")
```

### Find by XPath with multi-property predicate

```python
driver.find_element(AppiumBy.XPATH,
    "//Button[@Name='Submit' and @IsEnabled='true' and not(@IsOffscreen='true')]")
```

### Find using DSL — `Or` over distinct properties

```python
# Element matches if Name is 'OK' OR AutomationId is 'btnOk'
driver.find_element("-windows uiautomation",
    "Or(Name='OK', AutomationId='btnOk')")
```

### Find the focused element

```python
focused = driver.switch_to.active_element
```

### Find a menu item, drilling through expanded menus

```python
file_menu = driver.find_element(AppiumBy.XPATH, "//MenuBar//MenuItem[@Name='File']")
file_menu.click()  # Expand the menu
# Now the popup is visible — find the item via the desktop root
save = driver.find_element(AppiumBy.XPATH, "//MenuItem[@Name='Save']")
save.click()
```

### Find the "current" window when handles are unstable

```python
title = driver.title          # uses W3C getTitle → root-window Name
print(f"current window: {title}")
```

---

## "Why can't I find this element?" — troubleshooting

A flowchart for the most common cases. Start at the top, follow the first branch that matches.

### 1. Is the element visible in `getPageSource()`?

```python
print(driver.page_source)
```

- **No** → it's filtered out by ControlView. Switch to RawView via `windows: cacheRequest` (see [Tree views](#tree-views--rawview-vs-controlview-vs-contentview)).
- **Yes** → continue to step 2.

### 2. Does the XPath select it when run on the page-source XML?

Save `page_source` to a file and run your XPath against it (e.g. via `xmllint --xpath` or an online tester). The page source is faithful to the UIA tree, so an XPath that doesn't match the source won't match the live tree either.

- **No** → fix the XPath. Common issues:
  - Wrong tag name (e.g. `Button` vs `button` — case-sensitive)
  - Wrong attribute (`Name` vs `name`, `AutomationId` vs `id`)
  - Missing parent context — element is nested inside another window
- **Yes** but live find fails → continue to step 3.

### 3. Is the element off-screen?

```python
el = driver.find_elements(AppiumBy.XPATH, "//YourSelector")  # plural — returns [] not error
if el and driver.get_property(el[0], "IsOffscreen") == "True":
    # Need to scroll into view first
    driver.execute_script("windows: scrollIntoView", [el[0]])
```

If the element is off-screen, some operations (`click`, `getClickablePoint`) work but others may not. The driver's `click` does an automatic scroll-into-view, but `windows: click` with explicit coordinates bypasses that.

### 4. Is the element in a different window?

The driver's session is bound to one root element (the `app` from caps). Other windows aren't searchable until you switch:

```python
# List all top-level windows
for handle in driver.window_handles:
    print(handle)
# Switch by handle (hex string) or window name
driver.switch_to.window("Notepad")
```

### 5. Is the search slow / timing out?

Likely a deep tree + non-pushed-down XPath. Try:

- Anchor at a window: `//Window[@AutomationId='Main']//YourSelector` instead of `//YourSelector`
- Configure `windows: cacheRequest` with a `treeFilter` matching your scope before the find
- Use `accessibility id` if the AutomationId is stable

### 6. Is `appium:powerShellCommandTimeout` exceeded?

Default is 60 000 ms. For unusually deep trees on slow VMs, bump it:

```json
{ "appium:powerShellCommandTimeout": 120000 }
```

### 7. Did the element exist briefly then disappear?

Check the page source again immediately after the find fails — UIA trees mutate as the app processes events. A `WebDriverWait` with a polling interval is the canonical fix:

```python
WebDriverWait(driver, 10, poll_frequency=0.5).until(
    EC.presence_of_element_located((AppiumBy.XPATH, "//YourSelector"))
)
```

### 8. Does the element exist as a Win32 / MSAA-only proxy?

Some legacy controls don't expose modern UIA properties — they appear in the tree but with empty `Name`, `AutomationId`, etc. Use `LegacyName` / `LegacyValue` etc. (see [Commands → getProperty](./commands.md#getpropertypropertyname-elementid)) or fall back to `class name` matching.

### Still stuck

`getAttributes` dumps every UIA + MSAA + pattern property an element exposes:

```python
import json
attrs = json.loads(driver.execute_script("windows: getAttributes", [el]))
print(attrs)
```

That's the rawest possible view of what UIA sees for a given element.

---

## See also

- [Capabilities](./capabilities.md) — `convertAbsoluteXPathToRelativeFromElement`, `includeContextElementInSearch`, `powerShellCommandTimeout`
- [Commands → getProperty](./commands.md#getpropertypropertyname-elementid) — reading element attributes after a find
- [Extensions → cacheRequest](./extensions.md#cacherequest) — switching to RawView
- [Architecture overview](../architecture/overview.md#find-element-flow) — the request flow under the hood
- [Error codes](./error-codes.md) — how `NoSuchElementError` and `InvalidSelectorError` are surfaced
