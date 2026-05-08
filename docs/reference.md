# Internals Reference

Driver architecture overview and a function-level inventory of every module under `lib/`.

- [Architecture](#architecture)
- [Function Reference](#function-reference)

---

## Architecture

This section provides a high-level overview of the architectural components and design patterns used in the `appium-novawindows2-driver`.

### Core Components

#### `NovaWindows2Driver` Class

Located in [`lib/driver.ts`](../lib/driver.ts), this is the central orchestrator.
- **Inheritance**: Extends Appium's `BaseDriver`.
- **Responsibilities**:
    - Managing session lifecycle (`createSession`, `deleteSession`).
    - Dispatching commands to specialized modules.
    - Managing a long-running PowerShell child process for UI interaction.
    - Handling locator strategies and element finding.

#### Command Architecture

Appium commands are modularized in the [`lib/commands/`](../lib/commands) directory.
- Commands are split by functionality:
    - `actions.ts`: Input interactions (click, keys, mouse).
    - `app.ts`: Application management (install, launch, close).
    - `element.ts`: Element-specific operations (text, attribute, displayed).
    - `extension.ts`: Custom driver extensions.
- All commands are bound to the `NovaWindows2Driver` instance in its constructor, allowing them to access the driver's state and communication methods.

### Communication Layer

#### PowerShell Integration

The driver uses a long-running PowerShell session to interact with the Windows UI Automation (UIA) framework.
- **DSL (Domain Specific Language)**: Located in [`lib/powershell/`](../lib/powershell), this provides a TypeScript DSL for building complex PowerShell commands.
    - `AutomationElement`: Represents a UIA element.
    - `Condition`: Used for filtering and finding elements (Property, Or, And).
- **Execution**: Commands are serialized into PowerShell script blocks and sent via `stdin` to a `pwsh` or `powershell` process. Results are captured from `stdout`.

#### WinAPI Access

For low-level operations that PowerShell or UIA cannot handle easily, the driver uses direct Win32 API calls via [`lib/winapi/user32.ts`](../lib/winapi/user32.ts).
- Currently used for setting DPI awareness to ensure accurate coordinate calculation.

### Element Resolution

#### Locator Strategies

The driver supports standard Appium strategies and a custom `-windows uiautomation` strategy:
- `id`, `name`, `accessibility id`, `class name`, `tag name`, `xpath`.
- `-windows uiautomation`: Accepts a stringified PowerShell condition.

#### XPath Engine

Located in [`lib/xpath/`](../lib/xpath), the driver implements a custom XPath-to-UIA-Condition mapper.
- This allows users to use standard XPath queries which are then translated into efficient PowerShell discovery commands.

### Directory Structure (`lib/`)

| Directory | Description |
| :--- | :--- |
| `commands/` | Implementation of W3C and Appium-specific commands. |
| `powershell/` | DSL and core logic for PowerShell/UIA interaction. |
| `winapi/` | Win32 API bindings and types. |
| `xpath/` | XPath translation engine. |
| `constraints.ts` | Capability definitions and validation rules. |
| `driver.ts` | Main driver entry point and session management. |
| `enums.ts` | Shared constants and enums (e.g., control types, properties). |
| `util.ts` | Common helper functions. |

> [!NOTE]
> The driver prioritizes performance by maintaining a persistent PowerShell session, avoiding the overhead of spawning new processes for every command.

---

## Function Reference

A function-level inventory of every module under `lib/`. Format per entry:

`functionName(args) -> returnType` — purpose. (file:line)

Group order roughly mirrors the dependency graph: driver core → commands → PowerShell layer → XPath engine → Win32 FFI.

### 1. Driver Core

#### lib/driver.ts

`NovaWindows2Driver` (class) — Main Appium driver; extends `BaseDriver`, owns the persistent PowerShell session and dispatches W3C commands. (driver.ts:59)

- `constructor(opts, shouldValidateCaps)` — Initializes capabilities and keyboard modifier-state tracking. (driver.ts:74)
- `executeCommand(cmd, ...args)` — Wraps base execution to track active-command count for timeout deferral. (driver.ts:88)
- `startNewCommandTimeout()` — Defers the idle timeout while commands are still in flight. (driver.ts:97)
- `findElement(strategy, selector)` — W3C single-element find; normalizes selector first. (driver.ts:104)
- `findElements(strategy, selector)` — W3C multi-element find. (driver.ts:109)
- `findElementFromElement(strategy, selector, elementId)` — Relative single-element find with XPath normalization. (driver.ts:114)
- `findElementsFromElement(strategy, selector, elementId)` — Relative multi-element find. (driver.ts:122)
- `findElOrEls(strategy, selector, mult, context)` — Routes find calls by strategy (id, tag, xpath, accessibility id, UIA, name, class). (driver.ts:130)
- `createSession(jwpCaps, reqCaps, w3cCaps, driverData)` — Validates caps, starts PowerShell session, runs prerun script. (driver.ts:191)
- `deleteSession(sessionId)` — Closes the app, runs postrun, terminates PowerShell. (driver.ts:253)
- `processSelector(strategy, selector)` — Converts CSS-style selectors to Appium mobile locator strategies. (driver.ts:297)

#### lib/util.ts

- `getBundledFfmpegPath() -> string | null` — Resolves the bundled `ffmpeg-static` binary path. (util.ts:9)
- `assertSupportedEasingFunction(value) -> void` — Validates predefined easing names or `cubic-bezier(...)` strings. (util.ts:23)
- `sleep(ms) -> Promise<void>` — Promisified `setTimeout`. (util.ts:31)
- `parseRectJson(raw) -> Rect` — Parses PS-emitted rect JSON, replacing `Infinity` sentinels with `INT32_MAX`. (util.ts:40)
- `$(literals, ...substitutions) -> DeferredStringTemplate` — Builds a deferred template literal with positional indices. (util.ts:44)
- `DeferredStringTemplate` (class) — Holds a template + index list; `format(...args)` substitutes. (util.ts:54)

#### lib/constraints.ts

Capability constraints map for the driver (`smoothPointerMove`, `appWorkingDir`, `powerShellCommandTimeout`, `prerun`, `postrun`, etc.).

#### lib/enums.ts

- `Key` — Frozen object: WebDriver wire-protocol key constants (e.g. `SHIFT=''`). (enums.ts:13)
- `ClickType` — Frozen object: `'left'|'middle'|'right'|'back'|'forward'`. (enums.ts:88)

#### lib/constants.ts

Empty placeholder.

### 2. Commands

#### lib/commands/index.ts

Aggregates and re-exports every command module; merges into the driver prototype.

#### lib/commands/actions.ts (W3C Actions)

- `performActions(actionSequences) -> Promise<void>` — Routes W3C action sequences (key/pointer/wheel/null). (actions.ts:20)
- `releaseActions() -> Promise<void>` — No-op endpoint; modifier state is tracked per-call. (actions.ts:49)
- `handleKeyActionSequence(actionSequence)` — Plays a key sequence. (actions.ts:53)
- `handlePointerActionSequence(actionSequence)` — Routes pointer actions to the mouse handler. (actions.ts:60)
- `handleMousePointerActionSequence(actionSequence)` — Plays move/up/down/pause. (actions.ts:70)
- `handleWheelActionSequence(actionSequence)` — Plays scroll/pause. (actions.ts:94)
- `handleNullActionSequence(actionSequence)` — Plays pause-only. (actions.ts:113)
- `handleMouseMoveAction(action)` — Moves with easing to viewport, pointer-relative, or element-relative coords. (actions.ts:122)
- `handleKeyAction(action)` — Press/release with modifier tracking (SHIFT/CTRL/ALT/META). (actions.ts:156)

#### lib/commands/app.ts (App / Window)

- `getPageSource() -> Promise<string>` — XML tree of root element. (app.ts:41)
- `getScreenshot() -> Promise<string>` — Base64 PNG of root element. (app.ts:45)
- `getWindowRect() -> Promise<Rect>` — Bounding rect of root. (app.ts:61)
- `getWindowHandle() -> Promise<string>` — Hex HWND of root. (app.ts:66)
- `getWindowHandles() -> Promise<string[]>` — All top-level HWNDs. (app.ts:71)
- `setWindow(nameOrHandle) -> Promise<void>` — Switch root by HWND or window name (20 retries). (app.ts:84)
- `changeRootElement(pathOrNativeWindowHandle) -> Promise<void>` — Launch app (classic/UWP) or attach by HWND. (app.ts:116)
- `attachToApplicationWindow(processIds, attemptNumber) -> Promise<void>` — Probe HWNDs for populated UIA tree; leaf-element fallback. (app.ts:184)
- `title() -> Promise<string>` — Name of root element. (app.ts:309)
- `maximizeWindow() / minimizeWindow()` — Window state commands. (app.ts:316, 325)
- `back() / forward()` — Send Alt+Left / Alt+Right. (app.ts:334, 342)
- `closeApp() -> Promise<void>` — Close root window, clear state. (app.ts:350)
- `launchApp() -> Promise<void>` — Launch capability-defined `app`. (app.ts:356)
- `setWindowRect(x, y, width, height) -> Promise<Rect>` — Move/resize root window. (app.ts:363)

#### lib/commands/element.ts

- `getProperty(propertyName, elementId)` — UIA pattern, direct, MSAA legacy, source XML, or all properties. (element.ts:121)
- `getAttribute(propertyName, elementId)` — Deprecated wrapper for `getProperty`. (element.ts:174)
- `active() -> Promise<Element>` — Currently-focused element. (element.ts:179)
- `getName(elementId)` — Tag (control type) name. (element.ts:183)
- `getText(elementId)` — Text content. (element.ts:187)
- `clear(elementId)` — Clear value. (element.ts:191)
- `setValue(value, elementId)` — Type with modifier support, type delays, and SetValue fallback. (element.ts:195)
- `getElementRect(elementId)` — Rect relative to root. (element.ts:335)
- `elementDisplayed(elementId)` — `!IsOffscreen`. (element.ts:347)
- `elementSelected(elementId)` — Via `SelectionItem` or `Toggle` pattern. (element.ts:353)
- `elementEnabled(elementId)` — `IsEnabled`. (element.ts:363)
- `click(elementId)` — Bring ancestor on-top, scroll into view, position at clickable point with easing. (element.ts:368)
- `getElementScreenshot(elementId)` — Base64 PNG of element bounds. (element.ts:435)

#### lib/commands/device.ts

- `getDeviceTime(format) -> Promise<string>` — System time in given format (default ISO 8061). (device.ts:9)

#### lib/commands/file.ts

- `pushFile(remotePath, base64Data)` — Decode base64 and write, creating parent dirs. (file.ts:3)
- `pullFile(remotePath) -> Promise<string>` — Read file as base64. (file.ts:23)
- `pullFolder(remotePath) -> Promise<string>` — Zip folder, return as base64. (file.ts:37)

#### lib/commands/system.ts

- `getOrientation() -> Orientation` — Display orientation via Win32 metrics.

#### lib/commands/functions.ts

PowerShell helper-function templates: `GET_LEGACY_PROPERTY_SAFE`, `FIND_DESCENDANTS_FUNCTIONS`, `FIND_CHILDREN_RECURSIVELY`, `PAGE_SOURCE`.

#### lib/commands/powershell.ts (PowerShell session)

- `sendPowerShellCommand(command) -> Promise<string>` — Queue and run a command in the persistent session with timeout. (powershell.ts:169)
- `sendIsolatedPowerShellCommand(command) -> Promise<string>` — Run in a one-shot child process. (powershell.ts:201)
- `startPowerShellSession() -> Promise<void>` — Spawn `powershell.exe`, register stdin/exit error guards, init UIA assemblies, cache, helpers, and root element. (powershell.ts:229)
- `terminatePowerShellSession() -> Promise<void>` — Graceful stdin close with 5s kill fallback. (powershell.ts:335)

Internals: `expandEnvironmentVariables`, `ensureSessionReady`, `killProcessTree` (taskkill /F /T), `waitForCommandCompletion` (uses end-marker `___NOVA_WIN2_DRIVER_END___`).

#### lib/commands/screen-recorder.ts

- `uploadRecordedMedia(localFile, remotePath, uploadOptions) -> Promise<string>` — Upload or return base64. (screen-recorder.ts:46)
- `ScreenRecorder` (class) — ffmpeg-based recorder with FPS/time-limit/cursor/clicks/audio/filter options. (screen-recorder.ts:68)
  - `getVideoPath()` / `isRunning()` / `start()` / `stop(force)` (screen-recorder.ts:92, 105, 124, 195)
- `startRecordingScreen(options) -> Promise<void>` — Stops any running recording, then starts. (screen-recorder.ts:226)
- `stopRecordingScreen(uploadOptions) -> Promise<string>` — Stop and upload-or-return base64. (screen-recorder.ts:240)

#### lib/commands/extension.ts (`windows:` extension commands)

##### Dispatcher

- `execute(script, args) -> Promise<any>` — Routes `windows:*` commands and PowerShell scripts to handlers. (extension.ts:198)

##### `EXTENSION_COMMANDS` registry (extension.ts:37–71)

| Command | Handler |
|---|---|
| `windows: cacheRequest` | `pushCacheRequest` |
| `windows: invoke` | `patternInvoke` |
| `windows: expand` / `collapse` | `patternExpand` / `patternCollapse` |
| `windows: scrollIntoView` | `patternScrollIntoView` |
| `windows: isMultiple` | `patternIsMultiple` |
| `windows: selectedItem` / `allSelectedItems` | `patternGetSelectedItem` / `patternGetAllSelectedItems` |
| `windows: addToSelection` / `removeFromSelection` | `patternAddToSelection` / `patternRemoveFromSelection` |
| `windows: select` / `toggle` | `patternSelect` / `patternToggle` |
| `windows: setValue` / `getValue` | `patternSetValue` / `patternGetValue` |
| `windows: maximize` / `minimize` / `restore` / `close` | `patternMaximize` / `patternMinimize` / `patternRestore` / `patternClose` |
| `windows: setFocus` | `focusElement` |
| `windows: keys` | `executeKeys` |
| `windows: click` | `executeClick` |
| `windows: hover` | `executeHover` |
| `windows: scroll` | `executeScroll` |
| `windows: clickAndDrag` | `executeClickAndDrag` |
| `windows: getClipboard` / `setClipboard` | `getClipboardBase64` / `setClipboardFromBase64` |
| `windows: setProcessForeground` | `activateProcess` |
| `windows: getAttributes` | `getAttributes` |
| `windows: typeDelay` | `typeDelay` |
| `windows: startRecordingScreen` / `stopRecordingScreen` | `startRecordingScreen` / `stopRecordingScreen` (in screen-recorder.ts) |
| `windows: launchApp` / `closeApp` | `launchApp` / `closeApp` (in app.ts) |

##### Handlers

- `pushCacheRequest(cacheRequest)` — Validate and configure UIA cache (treeFilter, treeScope, mode). (extension.ts:255)
- `patternInvoke / patternExpand / patternCollapse` — Standard pattern triggers. (extension.ts:353, 358, 363)
- `patternScrollIntoView(element)` — ScrollItemPattern with keyboard fallback. (extension.ts:368)
- `scrollWithKeyboard(automationElement)` — Focus parent and press Page Down. (extension.ts:384)
- `patternIsMultiple(element) -> boolean` — `CanSelectMultiple`. (extension.ts:420)
- `patternGetSelectedItem / patternGetAllSelectedItems` — Read SelectionPattern selection. (extension.ts:425, 436)
- `patternAddToSelection / patternRemoveFromSelection / patternSelect / patternToggle`. (extension.ts:441, 445, 449, 454)
- `patternSetValue(element, value)` — ValuePattern with RangeValuePattern fallback for sliders. (extension.ts:459)
- `patternGetValue(element) -> string`. (extension.ts:481)
- `patternMaximize / patternMinimize / patternRestore / patternClose`. (extension.ts:485, 490, 495, 500)
- `focusElement(element)` — `SetFocus()`. (extension.ts:505)
- `getClipboardBase64(contentType)` — Plaintext or image base64. (extension.ts:510)
- `setClipboardFromBase64(args)`. (extension.ts:525)
- `executePowerShellScript(script)` — Persistent or isolated based on caps. (extension.ts:542)
- `executeKeys(keyActions)` — Pauses, text, virtual keys, optional Unicode. (extension.ts:561)
- `executeClick(clickArgs)` — Coordinates or element with modifiers/multi-click/duration. (extension.ts:620)
- `executeHover(hoverArgs)` — Smooth move with modifiers. (extension.ts:695)
- `executeScroll(scrollArgs)` — Wheel scroll over coords or element. (extension.ts:771)
- `activateProcess(args)` — Foreground a process's window. (extension.ts:817)
- `getAttributes(arg) -> string` — All UIA properties as JSON. (extension.ts:831)
- `typeDelay(args)` — Set global typing delay. (extension.ts:839)
- `executeClickAndDrag(args)` — Drag from start to end with modifiers/easing. (extension.ts:858)

##### Helpers

- `ensureElementResolved(driver, elementId)` — Validate/recover element id from session cache via RuntimeId lookup. (extension.ts:135)
- `withModifierKeys(keys, fn)` — Press, run, finally release modifiers. (extension.ts:171)
- `runPatternCommand(driver, command, patternName)` — Translate "Unsupported Pattern" / null-ref errors to W3C errors. (extension.ts:314)
- `resolvePatternElement(driver, element)` — Pull element id out of W3C dict and ensure resolution. (extension.ts:344)

### 3. PowerShell Layer (`lib/powershell/`)

#### lib/powershell/index.ts

Re-exports all child modules.

#### lib/powershell/core.ts

- `PSObject` (class) — Base wrapper carrying a PowerShell command string. (core.ts:3)
- `pwsh(strings, values) -> string` — Encodes a command as base64-wrapped `Invoke-Expression`. (core.ts:15)
- `pwsh$(literals, substitutions)` — Deferred-template variant of `pwsh`. (core.ts:25)
- `decodePwsh(command) -> string` — Recursively decode base64 `Invoke-Expression` for logging. (core.ts:41)

#### lib/powershell/common.ts (PSObject subtypes)

- `PSString` — Unicode-escaped PS string literal. (common.ts:12)
- `PSBoolean` — `$true`/`$false`. (common.ts:21)
- `PSInt32` / `PSInt32Array` — `[int32]` / `[int32[]]`. (common.ts:30, 39)
- `PSAutomationHeadingLevel` — `[AutomationHeadingLevel]::X`. (common.ts:49)
- `PSOrientationType` — `[OrientationType]::X`. (common.ts:62)
- `PSControlType` — `[ControlType]::X` with special cases for SemanticZoom and AppBar. (common.ts:75)
- `PSPoint` — `[System.Windows.Point]::new(x, y)`. (common.ts:95)
- `PSRect` — `[System.Windows.Rect]::new(x, y, w, h)`. (common.ts:106)
- `PSAutomationElement` — Element ref via W3C key. (common.ts:117)
- `PSCultureInfo` — `[System.Globalization.CultureInfo]::new(...)`. (common.ts:127)

#### lib/powershell/conditions.ts (UIA Condition AST)

- `Condition` (abstract). (conditions.ts:41)
- `PropertyCondition(property, value)` — Type-checked PropertyCondition. (conditions.ts:47)
- `AndCondition(...) / OrCondition(...) / NotCondition(c)` — Boolean combinators. (conditions.ts:115, 129, 143)
- `TrueCondition() / FalseCondition()` — `[Condition]::TrueCondition` / `FalseCondition`. (conditions.ts:153, 159)
- `assertPSObjectType(obj, type) -> void` — Throws InvalidArgumentError on type mismatch. (conditions.ts:165)

#### lib/powershell/converter.ts

- `convertStringToCondition(selector) -> Condition` — Parses Windows Automation selector DSL (control types, property conditions, And/Or/Not, points, rects, escape sequences) into a typed Condition tree. (converter.ts:105)

#### lib/powershell/regex.ts

- `RegexItem` — Pattern + placeholder validator + `toRegex()`. (regex.ts:6)
- `VarArgsRegexMatcher` — Comma-separated arg list matcher. (regex.ts:26)
- `ConstructorRegexMatcher(fqName, ...params)` — `Namespace.Class(...)` matcher. (regex.ts:32)
- `PropertyRegexMatcher(ns, ...props)` — `Namespace.Property` matcher. (regex.ts:44)
- `StringRegexMatcher()` — Single-quoted PS strings with `''` escape. (regex.ts:56)

#### lib/powershell/elements.ts (UIA Element AST + script templates)

##### Constants

- `TreeScope` — Frozen scope enum (ancestors, descendants, children, subtree, …). (elements.ts:634)
- `AutomationElementMode` — `none` / `full`. (elements.ts:651)

##### Tree-walk script templates (UIA navigation)

| Symbol | Behavior |
|---|---|
| `FIND_ALL_ANCESTOR` / `FIND_FIRST_ANCESTOR` / `FIND_ALL_ANCESTOR_OR_SELF` / `FIND_FIRST_ANCESTOR_OR_SELF` | Walk parent chain. (elements.ts:7–73) |
| `FIND_PARENT` | Immediate parent matching condition. (elements.ts:74) |
| `FIND_FOLLOWING` / `FIND_ALL_FOLLOWING` / `FIND_FOLLOWING_SIBLING` / `FIND_ALL_FOLLOWING_SIBLING` | Forward sibling-tree traversal. (elements.ts:83–149) |
| `FIND_PRECEDING` / `FIND_ALL_PRECEDING` / `FIND_PRECEDING_SIBLING` / `FIND_ALL_PRECEDING_SIBLING` | Backward sibling-tree traversal. (elements.ts:151–217) |
| `FIND_CHILDREN_OR_SELF` / `FIND_ALL_CHILDREN_OR_SELF` | Self + children. (elements.ts:219–246) |
| `FIND_DESCENDANTS` / `FIND_ALL_DESCENDANTS` / `FIND_DESCENDANTS_OR_SELF` / `FIND_ALL_DESCENDANTS_OR_SELF` | Subtree search via helper funcs. (elements.ts:247–251) |
| `FIND_FIRST` / `FIND_ALL` | UIA `FindFirst`/`FindAll(scope, condition)`. (elements.ts:253–254) |

##### Element-table & property templates

- `AUTOMATION_ROOT` / `FOCUSED_ELEMENT` / `ROOT_ELEMENT` (elements.ts:256–258)
- `SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID` — Cache element by RuntimeId, return id. (elements.ts:260)
- `ELEMENT_TABLE_GET` — Lookup by RuntimeId. (elements.ts:270)
- `GET_ELEMENT_PROPERTY` / `GET_ELEMENT_PATTERN_PROPERTY` / `GET_ELEMENT_LEGACY_PROPERTY` — UIA / pattern / MSAA reads. (elements.ts:274, 284, 297)
- `GET_ALL_ELEMENT_PROPERTIES` — JSON of all UIA + pattern flags + MSAA. (elements.ts:324)
- `GET_ELEMENT_SOURCE` / `GET_ELEMENT_RUNTIME_ID` / `GET_ELEMENT_RECT` / `GET_ELEMENT_TAG_NAME` (elements.ts:435, 442, 449, 459)
- `SET_FOCUS_TO_ELEMENT` / `BRING_ELEMENT_TO_FRONT` (elements.ts:472, 474)
- `GET_ELEMENT_TEXT` — TextPattern → Selection → Name fallback. (elements.ts:493)
- `INVOKE_ELEMENT` / `EXPAND_ELEMENT` / `COLLAPSE_ELEMENT`. (elements.ts:507–509)
- `SCROLL_ELEMENT_INTO_VIEW` — ScrollItem → SetFocus → MSAA → ancestor walk. (elements.ts:510)
- Selection: `IS_MULTIPLE_SELECT_ELEMENT`, `GET_SELECTED_ELEMENT`, `IS_ELEMENT_SELECTED`, `ADD_/REMOVE_/SELECT_ELEMENT`, `TOGGLE_ELEMENT`. (elements.ts:569–575)
- Value: `SET_ELEMENT_VALUE`, `SET_ELEMENT_RANGE_VALUE`, `GET_ELEMENT_VALUE`, `GET_ELEMENT_TOGGLE_STATE`. (elements.ts:576–588)
- Window: `MAXIMIZE_/MINIMIZE_/RESTORE_/CLOSE_WINDOW`, `MOVE_WINDOW`, `RESIZE_WINDOW`. (elements.ts:589–594)
- `GET_ELEMENT_SCREENSHOT` — `Graphics.CopyFromScreen` → PNG → base64. (elements.ts:596)

##### `AutomationElement` (class)

- `constructor(command)` / `setPsFilter(filter)`. (elements.ts:658, 665)
- Static refs: `automationRoot`, `rootElement`, `focusedElement`. (elements.ts:670–678)
- `findFirst(scope, condition)` / `findAll(scope, condition)` — Build PS commands. (elements.ts:682, 709)
- Builders: `buildGetTagNameCommand`, `buildGetPatternPropertyCommand`, `buildGetLegacyPropertyCommand`, `buildGetPropertyCommand`, `buildGetAllPropertiesCommand`, `buildGetSourceCommand`, `buildGetElementRectCommand`, `buildGetElementScreenshotCommand`, `buildBringToFrontCommand`, `buildSetFocusCommand`, `buildCommand`. (elements.ts:736–796)
- Static `getPropertyAccessor(property) -> string | undefined` — Maps property name → `$_.Current.X`. (elements.ts:797)

##### `AutomationElementGroup` (class)

- `constructor(...automationElements)` — `@(...)` array of element queries. (elements.ts:823)
- `findAllGroups(scope, condition)` / `findFirstGroups(scope, condition)`. (elements.ts:831, 835)

##### `FoundAutomationElement` (extends AutomationElement)

- `constructor(runtimeId)` — Lookup by RuntimeId. (elements.ts:840)
- Builders: `buildGetTextCommand`, `buildInvokeCommand`, `buildExpandCommand`, `buildCollapseCommand`, `buildScrollIntoViewCommand`, `buildIsMultipleSelectCommand`, `buildGetSelectionCommand`, `buildIsSelectedCommand`, `buildAddToSelectionCommand`, `buildRemoveFromSelectionCommand`, `buildSelectCommand`, `buildToggleCommand`, `buildSetValueCommand(value)`, `buildSetRangeValueCommand(value)`, `buildGetValueCommand`, `buildGetToggleStateCommand`, `buildMaximizeCommand`, `buildMinimizeCommand`, `buildRestoreCommand`, `buildCloseCommand`, `buildMoveCommand(x, y)`, `buildResizeCommand(w, h)`. (elements.ts:848–932)

#### lib/powershell/win32.ts

- `WIN32_HELPER_SCRIPT` — Embedded C# class loaded into PowerShell via `Add-Type`. Provides:
  - **Window mgmt**: `BringToForeground`, `SetTopMost`, `ClearTopMost`, `MinimizeWindow`, `RestoreWindow`, `IsMinimized`, `IsVisible`, `GetText`, `GetRect`, `GetProcessId`.
  - **MSAA fallback**: `SetExpectedPid`, `GetLegacyProperty`, `GetLegacyPropertyWithFallback`, `GetLegacyPropsWithFallback` (P/Invokes `oleacc.dll` + `user32.dll`).
  - **Console**: `ConsoleHelper` to suppress console interactions. (win32.ts:6)

#### lib/powershell/types.ts

Type declarations only.

### 4. XPath Engine (`lib/xpath/`)

#### lib/xpath/index.ts

Re-exports `core` and `functions`.

#### lib/xpath/core.ts

- `xpathToElIdOrIds(selector, mult, context, sendPowerShellCommand, includeContextElementInSearch) -> Promise<Element | Element[]>` — Public entry: parse XPath, run against UIA tree. (core.ts:113)
- `XPathExecutor` (class) — Walks/filters the UIA tree using XPath. (core.ts:163)
  - `processExprNode(exprNode, context, contextState)` — Recursively evaluate XPath nodes. (core.ts:171)
  - `handleLocationNode(location, context)` — Process location steps (axes). (core.ts:313)
  - `processExprNodeAsPredicate(exprNode, context, positions, relative)` — Convert predicates to PS conditions + JS filters. (core.ts:351)
  - `executeStep(step, context)` — Run a single step + predicates + position filtering. (core.ts:542)
- `convertNodeTestToCondition(nodeTest) -> Condition` — Map node tests to UIA conditions. (core.ts:678)
- `convertAttributeNodeTestToStringArray(nodeTest, context, sendPowerShellCommand) -> Promise<string[]>` — Read attribute values. (core.ts:715)
- `convertToElementArray(element)` / `flattenElementGroupsAndRemoveDuplicates(elements)` — Group flattening + RuntimeId dedup. (core.ts:771, 779)
- `optimizeDoubleSlash(steps, includeContextElementInSearch)` — `/descendant-or-self/child` → `/descendant`. (core.ts:799)
- `findLastStep(obj)` — Locate the final `steps` array. (core.ts:819)
- `predicateProcessableBeforeNode(exprNode) -> boolean` — Whether a predicate can be pushed into the PS query. (core.ts:841)
- `convertExprNodeToPowerShellFilter(exprNode) -> string | undefined` — Translate `contains()`/`starts-with()` to PS `Where-Object` filters. (core.ts:879)

#### lib/xpath/functions.ts

- `handleFunctionCall(name, context, executor, contextState, ...args)` — Dispatcher for XPath functions: `boolean`, `concat`, `contains`, `count`, `true`, `false`, `round`, `ceiling`, `floor`, `id`, `position`, `last`, `local-name`, `name`, `normalize-space`, `string-length`, `translate`, `number`, `string`, `substring`, `substring-before`, `substring-after`, `sum`. (functions.ts:39)
- `convertProcessedExprNodesToStrings(...)` — Coerce processed nodes to strings (elements → empty). (functions.ts:391)
- `convertProcessedExprNodesToNumbers(...)` — Coerce to numbers (boolean→1/0, element→NaN, string→parseFloat). (functions.ts:397)

### 5. Win32 FFI (`lib/winapi/`)

#### lib/winapi/user32.ts

##### Native bindings (koffi → user32.dll / kernel32.dll / psapi.dll)

| Function | Purpose | Line |
|---|---|---|
| `SendInput` | Queue keyboard/mouse input events | 292 |
| `GetSystemMetrics` | System metric value by ID | 293 |
| `SetProcessDPIAware` | Enable per-monitor DPI awareness | 294 |
| `GetDpiForSystem` | System-wide DPI | 295 |
| `GetCursorPos` | Current cursor coordinates | 296 |
| `EnumDisplaySettingsA` | Display mode settings | 297 |
| `GetWindowThreadProcessId` | PID owning HWND | 300 |
| `GetWindowTextA` | Window title | 301 |
| `IsWindowVisible` | Visibility check | 302 |
| `EnumWindows` | Enumerate top-level windows | 303 |
| `SetForegroundWindow` | Foreground a window | 304 |
| `ShowWindow` | Show/hide/minimize | 305 |
| `OpenProcess` / `CloseHandle` | Process handle lifecycle | 307, 308 |
| `GetModuleBaseNameA` | Process exe name | 309 |

##### Event constructors

- `makeKeyboardEvent(args) -> KeyboardEvent`. (user32.ts:312)
- `makeEmptyMouseEvent() -> MouseEvent`. (user32.ts:359)
- `makeMouseDownEvents(button) -> MouseEvent[]` / `makeMouseUpEvents(button) -> MouseEvent[]`. (user32.ts:375, 403)
- `makeMouseMoveEvents(args) -> MouseEvent[]` — Move/scroll events with optional easing. (user32.ts:431)
- `charToKeyboardEvents(char, down, forceUnicode) -> KeyboardEvent[]` — Special-key + Unicode aware conversion. (user32.ts:485)

##### Senders

- `sendKeyInput(char, down, forceUnicode)` (user32.ts:645)
- `sendMouseButtonInput(button, down)` (user32.ts:652)
- `sendMouseMoveInput(args) -> Promise<void>` — Optional bezier easing animation. (user32.ts:659)
- `sendMouseScrollInput(x, y)` — Horizontal + vertical wheel. (user32.ts:731)
- `assertSuccessSendInputReturnCode(returnCode)` — Throws on failure. (user32.ts:738)

##### Display / DPI

- `getResolutionScalingFactor() -> number` — Memoized `dpi/96`. (user32.ts:746)
- `getScreenResolutionAndRefreshRate() -> [w, h, hz]`. (user32.ts:756)

##### High-level wrappers

- `keyDown(char, forceUnicode)` / `keyUp(char, forceUnicode)`. (user32.ts:783, 787)
- `mouseMoveRelative(x, y, duration, easing) -> Promise<void>` (user32.ts:791)
- `mouseScroll(x, y)`. (user32.ts:795)
- `mouseMoveAbsolute(x, y, duration, easing, startX, startY) -> Promise<void>` (user32.ts:799)
- `mouseDown(button)` / `mouseUp(button)`. (user32.ts:803, 807)
- `getDisplayOrientation() -> 'LANDSCAPE' | 'PORTRAIT'`. (user32.ts:811)
- `setDpiAwareness()`. (user32.ts:816)
- `getWindowAllHandlesForProcessIds(processIds) -> Map<number, number[]>`. (user32.ts:822)
- `trySetForegroundWindow(hwnd) -> boolean`. (user32.ts:848)
- `showWindow(hwnd, nCmdShow) -> boolean`. (user32.ts:859)
- `findWindowHandle(processName) -> number | null`. (user32.ts:863)
- `sendKeyboardEvents(inputs) -> number`. (user32.ts:898)
- `getCursorPosition() -> [number, number]`. (user32.ts:905)

#### lib/winapi/types/

| File | Enum |
|---|---|
| `input.ts` | `InputType` — mouse / keyboard / hardware classification. |
| `keyeventf.ts` | `KeyEventFlags` — extended, key-up, scancode, Unicode. |
| `mouseeventf.ts` | `MouseEventFlags` — move, button states, wheel, absolute/relative. |
| `scancode.ts` | `ScanCode` — hardware scan codes for A–Z, 0–9, F-keys, numpad, special. |
| `systemmetric.ts` | `SystemMetric` — screen dims, DPI, mouse buttons, icon sizes, virtual screen. |
| `virtualkey.ts` | `VirtualKey` — Windows VK codes for letters, digits, F-keys, arrows, numpad, multimedia, IME. |
| `xmousebutton.ts` | `XMouseButton` — `XBUTTON1`, `XBUTTON2`. |
| `index.ts` | Barrel re-export. |

### Notable Cross-Module Flows

- **Find element flow**: `driver.findElOrEls` → `xpath/core.xpathToElIdOrIds` → `XPathExecutor.executeStep` → builds `AutomationElement` query (`powershell/elements.ts`) → wrapped by `core.pwsh` → executed via `commands/powershell.sendPowerShellCommand` → returns RuntimeId stored in `$elementTable`.
- **Click flow**: `commands/element.click` → resolves clickable point → `winapi/user32.mouseMoveAbsolute` (with easing) → `winapi/user32.mouseDown`/`mouseUp`. Bring-to-front goes through `BRING_ELEMENT_TO_FRONT` (`powershell/win32.WIN32_HELPER_SCRIPT`).
- **Property read flow**: `commands/element.getProperty` → `AutomationElement.buildGet*Command` → `commands/powershell.sendPowerShellCommand` → MSAA fallback path is `Win32Helper.GetLegacyPropertyWithFallback`.
- **Session lifecycle**: `createSession` → `startPowerShellSession` (loads UIA, win32 helper, page-source/find helpers, sets root) → commands flow → `deleteSession` → `closeApp` → `terminatePowerShellSession`.
