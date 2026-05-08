# Components

Per-directory walkthrough of `lib/`. Each section covers the directory's purpose, the key types/files, and where to look first when changing something.

For function-level signatures see [API inventory](./api-inventory.md).

## `lib/driver.ts` — driver class

The central orchestrator. `NovaWindows2Driver` extends Appium's `BaseDriver`.

| Concern | Method |
|---|---|
| Session lifecycle | `createSession`, `deleteSession` |
| Command timeout deferral | `executeCommand`, `startNewCommandTimeout` |
| Find-element dispatch | `findElement`, `findElements`, `findElementFromElement`, `findElementsFromElement`, `findElOrEls` |
| Selector normalisation | `processSelector` (CSS-style → Appium native strategy) |

Key instance fields (per-session state — see [Architecture overview](./overview.md#per-instance-state-isolation)):

```ts
class NovaWindows2Driver extends BaseDriver<...> {
    powerShell?: ChildProcessWithoutNullStreams;
    powerShellStdOut: string = '';
    powerShellStdErr: string = '';
    commandQueue: Promise<any> = Promise.resolve();
    powerShellRestartPromise?: Promise<void>;
    keyboardState: KeyboardState;
}
```

The constructor binds every command handler from `lib/commands/index.ts` onto the instance, so `this.click()` actually calls `commands/element.ts::click` with `this` bound to the driver.

## `lib/commands/` — handler modules

Where every Appium-protocol method actually lives. One file per topic. The `index.ts` bundles them into a single object that the driver class merges in.

| File | Handlers |
|---|---|
| `actions.ts` | W3C Action sequences — `performActions`, `releaseActions`, plus internal `handleKeyAction`, `handleMousePointerActionSequence`, etc. |
| `app.ts` | Window/app lifecycle — `getPageSource`, `getScreenshot`, `getWindowRect`, `getWindowHandle(s)`, `setWindow`, `changeRootElement`, `attachToApplicationWindow`, `title`, `maximize/minimizeWindow`, `back`/`forward`, `closeApp`, `launchApp`, `setWindowRect` |
| `element.ts` | Element-level ops — `click`, `setValue`, `clear`, `getText`, `getName`, `getProperty`, `getAttribute` (deprecated), `getElementRect`, `elementDisplayed/Selected/Enabled`, `active`, `getElementScreenshot` |
| `extension.ts` | All `windows:*` extension commands — see [Extensions](../reference/extensions.md). Routes via the `EXTENSION_COMMANDS` registry. ~950 LOC, the largest file in the project |
| `powershell.ts` | The persistent PS session itself — `sendPowerShellCommand`, `sendIsolatedPowerShellCommand`, `startPowerShellSession`, `terminatePowerShellSession`, `ensurePowerShellSession` (auto-restart). See [PowerShell session](./powershell-session.md) |
| `screen-recorder.ts` | FFmpeg-based screen recording — `ScreenRecorder` class, `startRecordingScreen`, `stopRecordingScreen`, `uploadRecordedMedia`. Lazy-loads `asyncbox` + `teen_process` so the driver loads on hosts without the recording stack (Win-ARM64 in particular) |
| `device.ts` | `getDeviceTime` |
| `file.ts` | `pushFile`, `pullFile`, `pullFolder` |
| `system.ts` | `getOrientation` (one line — delegates to winapi) |
| `functions.ts` | PowerShell **template strings** loaded into the persistent session — `GET_LEGACY_PROPERTY_SAFE`, `FIND_DESCENDANTS_FUNCTIONS`, `FIND_CHILDREN_RECURSIVELY`, `PAGE_SOURCE`. Not handlers — code that runs inside PS |

Common patterns across handlers:

- **`resolvePatternElement(driver, element)`** + **`ensureElementResolved(driver, id)`** in `extension.ts` — every pattern handler calls these first to validate the element id and re-find it via `RuntimeId` if it's been evicted from `$elementTable`. Produces clean `NoSuchElementError` instead of raw PowerShell "null-valued expression" messages.
- **`runPatternCommand(driver, command, patternName)`** in `extension.ts` — wraps a PS pattern call and translates "Unsupported Pattern" / null-ref errors into W3C `UnknownError` with actionable messages.
- **`withModifierKeys(keys, fn)`** in `extension.ts` — presses modifiers, runs `fn`, releases them in `finally` so a thrown error doesn't leak a held key.

## `lib/powershell/` — PS DSL

A TypeScript domain-specific language for building PowerShell commands. Every command sent to the persistent PS session is built through this layer — there are essentially no raw PowerShell strings scattered across `commands/`.

### `core.ts` — base wrapping

| Symbol | Purpose |
|---|---|
| `PSObject` (class) | Base wrapper that carries a PowerShell command string |
| `pwsh` (tagged template) | `pwsh\`Get-Date\`` → wraps in base64-encoded `Invoke-Expression` so quoting is safe |
| `pwsh$` (deferred template) | Same idea but with positional `${0}` / `${1}` placeholders, evaluated later via `.format(args)` |
| `decodePwsh(cmd)` | Recursively decode a base64-wrapped command back to plain PS for logging/debugging |

Why base64-wrap? PowerShell's `Invoke-Expression -EncodedCommand` doesn't care about quoting in the original text — backticks, single quotes, double quotes, all fine. This eliminates a whole class of injection / escaping bugs.

### `common.ts` — typed PS literals

`PSObject` subtypes that produce well-formed PowerShell representations of common values:

| Subtype | Output |
|---|---|
| `PSString(s)` | `[string]([char]...,[char]...,...)` — Unicode-escaped, no quoting required |
| `PSBoolean(b)` | `$true` / `$false` |
| `PSInt32(n)` / `PSInt32Array(arr)` | `[int32]N` / `[int32[]]@(...)` |
| `PSPoint({x,y})` | `[System.Windows.Point]::new(x, y)` |
| `PSRect({x,y,w,h})` | `[System.Windows.Rect]::new(x, y, w, h)` |
| `PSControlType(t)` | `[ControlType]::Button` (with special cases for SemanticZoom, AppBar) |
| `PSAutomationElement(el)` | Looks up element by W3C key |
| `PSCultureInfo(...)` / `PSAutomationHeadingLevel(...)` / `PSOrientationType(...)` | Enum/object literals |

Use these instead of string-interpolating values into PS commands. They're the type-safe layer over `core.pwsh`.

### `conditions.ts` — UIA Condition AST

UIA's `Condition` API as a TypeScript class hierarchy. Used by find-element to express the search:

```ts
new AndCondition(
    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('Button')),
    new PropertyCondition(Property.NAME, new PSString('OK'))
)
```

Builds:

```powershell
[AndCondition]::new(
    [PropertyCondition]::new([AutomationElement]::ControlTypeProperty, [ControlType]::Button),
    [PropertyCondition]::new([AutomationElement]::NameProperty, [string]([char]79,[char]75)))
```

Combinators: `AndCondition`, `OrCondition`, `NotCondition`, plus singletons `TrueCondition()` / `FalseCondition()`.

### `converter.ts` — selector DSL parser

Parses the `-windows uiautomation` strategy string (the user-facing "raw UIA condition" syntax) into a `Condition` tree.

Input: `Name='OK' And ControlType=Button And IsEnabled=true`
Output: `AndCondition(PropertyCondition(Name, "OK"), PropertyCondition(ControlType, Button), PropertyCondition(IsEnabled, true))`

Handles property conditions, And/Or/Not, points, rects, escape sequences, and array parameters via a placeholder-based regex strategy.

### `regex.ts`

Building blocks for `converter.ts` — `RegexItem`, `VarArgsRegexMatcher`, `ConstructorRegexMatcher`, `PropertyRegexMatcher`, `StringRegexMatcher`. Pure helpers, no logic.

### `elements.ts` — UIA element builders

The biggest file in `lib/powershell/` (~930 LOC). Two layers:

**1. PowerShell template strings** — pre-baked `pwsh$` templates for every UIA operation. Examples:

| Template | Generates |
|---|---|
| `FIND_FIRST` / `FIND_ALL` | `${0}.FindFirst(${1}, ${2})` etc. |
| `FIND_ALL_ANCESTOR` / `FIND_PARENT` / `FIND_FOLLOWING_SIBLING` etc. | XPath axes (12 variants) |
| `FIND_DESCENDANTS` / `FIND_ALL_DESCENDANTS` | Calls into helper PS functions for the deep walks |
| `GET_ELEMENT_PROPERTY` / `GET_ELEMENT_PATTERN_PROPERTY` / `GET_ELEMENT_LEGACY_PROPERTY` | Property reads — UIA / pattern / MSAA |
| `GET_ALL_ELEMENT_PROPERTIES` | JSON dump |
| `GET_ELEMENT_RECT` / `GET_ELEMENT_TEXT` / `GET_ELEMENT_TAG_NAME` | Direct queries |
| `INVOKE_ELEMENT` / `EXPAND_ELEMENT` / `COLLAPSE_ELEMENT` / `TOGGLE_ELEMENT` | UIA pattern triggers |
| `SCROLL_ELEMENT_INTO_VIEW` | Multi-step: ScrollItem → SetFocus → MSAA → ancestor walk |
| `SET_ELEMENT_VALUE` / `SET_ELEMENT_RANGE_VALUE` / `GET_ELEMENT_VALUE` | Value pattern reads/writes |
| `MAXIMIZE_WINDOW` / `MINIMIZE_WINDOW` / `RESTORE_WINDOW` / `CLOSE_WINDOW` / `MOVE_WINDOW` / `RESIZE_WINDOW` | Window pattern |
| `GET_ELEMENT_SCREENSHOT` | `Graphics.CopyFromScreen` → PNG → base64 |
| `SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID` / `ELEMENT_TABLE_GET` | Cache-by-RuntimeId mechanics |

**2. Class hierarchy** — `AutomationElement` is the base. It carries a PS expression that resolves to an element. Subclass `FoundAutomationElement(runtimeId)` is what command handlers use most — it represents an already-cached element.

```ts
const el = new FoundAutomationElement('42.1234');
el.buildClickPointCommand();         // "$elementTable['42.1234'].GetClickablePoint()"
el.buildSetValueCommand('hi');       // "[ValuePattern]::Pattern.SetValue('hi')"
el.buildGetPropertyCommand('Name');  // "$elementTable['42.1234'].Current.Name"
```

There's also `AutomationElementGroup` for `@(elA, elB, elC)` array semantics in `findFirst`/`findAll` calls.

### `win32.ts` — embedded C# helper

A single big string constant: `WIN32_HELPER_SCRIPT`. Loaded into the PS session at startup via `Add-Type` — it compiles a C# class called `Win32Helper` with these methods:

**Window management** (P/Invoke to `user32.dll`):
- `BringToForeground`, `SetTopMost`, `ClearTopMost`, `MinimizeWindow`, `RestoreWindow`, `IsMinimized`, `IsVisible`, `GetText`, `GetRect`, `GetProcessId`

**MSAA fallback** (P/Invoke to `oleacc.dll`):
- `SetExpectedPid`, `GetLegacyProperty`, `GetLegacyPropertyWithFallback`, `GetLegacyPropsWithFallback`

**Console hardening**: `ConsoleHelper` to suppress interactive console behaviour.

Why C# and not pure PowerShell? Because P/Invoke from PS is awkward to write defensively, and the same helper class is used in many places — cheaper to compile once at startup.

### `index.ts`

Barrel — re-exports everything from the layer.

### `types.ts`

Type declarations (`Property` enum, etc.). No runtime code.

## `lib/xpath/` — XPath 1.0 engine

Translates W3C XPath 1.0 expressions into UIA tree walks.

### `core.ts` (~900 LOC)

The bulk of the engine.

| Symbol | Purpose |
|---|---|
| `xpathToElIdOrIds(selector, mult, context, sendPowerShellCommand, ...)` | Public entry — parse + execute |
| `XPathExecutor` (class) | Runs a parsed XPath against the UIA tree, one step at a time |
| `XPathExecutor.processExprNode` | Recursive evaluator — numbers, literals, unions, function calls, location paths, filters, operators |
| `XPathExecutor.handleLocationNode` | Per-axis traversal logic |
| `XPathExecutor.executeStep` | Single step + predicates + position filtering |
| `XPathExecutor.processExprNodeAsPredicate` | Convert a predicate to a PS-side `Where-Object` filter when possible (push-down optimisation) |
| `convertNodeTestToCondition` | Map node tests to UIA `Condition` |
| `convertAttributeNodeTestToStringArray` | Read attribute values through PS |
| `optimizeDoubleSlash` | `/descendant-or-self/child` → `/descendant` (the common `//` case) |
| `predicateProcessableBeforeNode` | Decide whether a predicate is push-downable or must run in JS post-fetch |
| `convertExprNodeToPowerShellFilter` | Translate `contains()` / `starts-with()` to PS `Where-Object` filter strings |

The push-down optimisation is the key correctness + performance win. For `//ListItem[contains(@Name,'Invoice')]`, the engine recognises `contains` as PS-evaluable, builds a `Where-Object { $_.Current.Name -like '*Invoice*' }` filter, and runs the whole thing in a single PS round-trip — no enumeration of every ListItem back to Node.

### `functions.ts` (~400 LOC)

XPath 1.0 standard function library — `boolean`, `concat`, `contains`, `count`, `true`, `false`, `round`, `ceiling`, `floor`, `id`, `position`, `last`, `local-name`, `name`, `normalize-space`, `string-length`, `translate`, `number`, `string`, `substring`, `substring-before`, `substring-after`, `sum`.

Plus coercion helpers `convertProcessedExprNodesToStrings` and `convertProcessedExprNodesToNumbers` that handle the spec's quirky boolean→1/0 / element→NaN / string→parseFloat rules.

### `index.ts`

Barrel re-export.

## `lib/winapi/` — Win32 FFI

Direct Win32 API access via [koffi](https://www.npmjs.com/package/koffi). No N-API addons, no native build step — koffi loads DLLs at runtime.

### `user32.ts` (~900 LOC)

Three layers: native bindings → event constructors → high-level wrappers.

**Native bindings** (koffi → `user32.dll` / `kernel32.dll` / `psapi.dll`):

| Function | Purpose |
|---|---|
| `SendInput` | Queue keyboard/mouse input events |
| `GetSystemMetrics` / `GetDpiForSystem` / `SetProcessDPIAware` | DPI / display |
| `GetCursorPos` / `EnumDisplaySettingsA` | Cursor + display modes |
| `GetWindowThreadProcessId` / `GetWindowTextA` / `IsWindowVisible` / `EnumWindows` / `SetForegroundWindow` / `ShowWindow` | Window enumeration + state |
| `OpenProcess` / `CloseHandle` / `GetModuleBaseNameA` | Process metadata |

**Event constructors**: `makeKeyboardEvent`, `makeMouseDownEvents`, `makeMouseUpEvents`, `makeMouseMoveEvents`, `charToKeyboardEvents`. Build the structs `SendInput` expects.

**Senders**: `sendKeyInput`, `sendMouseButtonInput`, `sendMouseMoveInput` (with optional bezier easing animation), `sendMouseScrollInput`. The high-level click/type code in `commands/element.ts` and `commands/extension.ts` calls these.

**Display / DPI**: `getResolutionScalingFactor`, `getScreenResolutionAndRefreshRate`. Used to convert user-supplied logical coords to physical pixels for `SendInput`.

**Public wrappers**: `keyDown`, `keyUp`, `mouseMoveRelative`, `mouseMoveAbsolute`, `mouseDown`, `mouseUp`, `mouseScroll`, `getDisplayOrientation`, `setDpiAwareness`, `getWindowAllHandlesForProcessIds`, `trySetForegroundWindow`, `showWindow`, `findWindowHandle`, `getCursorPosition`. These are what `commands/*` calls.

### `types/`

Pure enum declarations — Win32 constants from `<winuser.h>`:

| File | Enum |
|---|---|
| `input.ts` | `InputType` (mouse / keyboard / hardware) |
| `keyeventf.ts` | `KeyEventFlags` (extended, key-up, scancode, Unicode) |
| `mouseeventf.ts` | `MouseEventFlags` (move, button states, wheel, absolute/relative) |
| `scancode.ts` | `ScanCode` (hardware scan codes — A–Z, 0–9, F-keys, numpad) |
| `systemmetric.ts` | `SystemMetric` (screen dims, DPI, mouse buttons, virtual screen) |
| `virtualkey.ts` | `VirtualKey` (Windows VK codes) |
| `xmousebutton.ts` | `XMouseButton` (XBUTTON1, XBUTTON2) |
| `index.ts` | Barrel |

## `lib/util.ts` — shared helpers

Small, generally-applicable utilities:

- `parseRectJson(raw)` — parse PS-emitted rect JSON, replacing `Infinity` sentinels (PS uses these for off-screen elements) with `INT32_MAX` so the result is JSON-valid
- `sleep(ms)` — `Math.max(ms, 0)` clamp + setTimeout promise
- `assertSupportedEasingFunction(value)` — validates predefined easing names or `cubic-bezier(...)` strings
- `getBundledFfmpegPath()` — resolves `ffmpeg-static`, returns `null` if not installed (used by screen recorder for the optional-dep check)
- `$(literals, ...substitutions)` + `DeferredStringTemplate` class — the deferred template literal used by `pwsh$`

## `lib/enums.ts` — wire-protocol constants

Two frozen objects used across the codebase:

- `Key` — WebDriver wire-protocol key constants (`SHIFT`, `CONTROL`, `ENTER`, etc. — Unicode PUA characters)
- `ClickType` — `'left' | 'middle' | 'right' | 'back' | 'forward'`

## `lib/constraints.ts` — capability validation

Single export: a `Constraints` object that Appium's base driver uses to validate capabilities. Lists every supported `appium:` and `ms:` capability with its type, allowed values, and presence rule. See [Capabilities](../reference/capabilities.md) for the user-facing view.

## `lib/constants.ts`

Currently empty. Reserved for shared constants if/when needed.

## `lib/commands/index.ts` — handler binding

The constructor of `NovaWindows2Driver` calls `Object.assign(this, commands)` (effectively) using this module's barrel export. That's how every handler in `lib/commands/*.ts` becomes a method on the driver instance.

## See also

- [Architecture overview](./overview.md) — how the layers fit together
- [PowerShell session](./powershell-session.md) — deep-dive on the persistent PS process
- [API inventory](./api-inventory.md) — every function with file:line refs
