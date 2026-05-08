# `appium-novawindows2-driver` — Project Overview

**Version:** 1.1.8
**Package:** `appium-novawindows2-driver`
**Author:** nguyenvanhuy0612 (SecureAge)
**License:** Apache-2.0
**Analysis date:** 2026-04-23

> Forked from [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver); see §9 at the bottom for a quick check of upstream commits.

---

## 1. Purpose

`appium-novawindows2-driver` is an **Appium 3 driver for automating Windows desktop applications**. It talks to applications through Microsoft's **UI Automation (UIA)** framework using a **persistent PowerShell session** as the automation backend — no WinAppDriver, no Developer Mode, no extra services.

It exists to solve three chronic pain points in existing Windows automation stacks (WinAppDriver, legacy `appium-windows-driver`):

1. **Slow element lookups** — especially XPath across deep, complex UI trees.
2. **Hidden / off-tree elements** — elements filtered out by the default ControlView/ContentView are hard or impossible to reach.
3. **Keyboard input quirks** — incorrect characters under non-US layouts, dropped characters, no per-character delay control.

The driver targets:
- **UWP** (Universal Windows Platform) apps
- **WinForms** applications
- **WPF** (Windows Presentation Foundation) applications
- **Classic Win32** desktop applications

Host requirement: **Windows 10 or later (x64 or ARM64)**. PowerShell 5.1+ is used (ships with Windows).

### Why this fork exists
The SecureAge fork (`novawindows2`) diverged from upstream around late-2026-Q1 and is focused on **XPath correctness, PowerShell-backend robustness, and a deep unit-test suite**. It ships as its own npm package with its own `automationName` (`NovaWindows2`) so it can be installed alongside the upstream driver on the same Appium server.

---

## 2. Key Features in Detail

### 2.1 High-performance XPath engine
- **Full W3C XPath 1.0** parser implemented in-repo (`lib/xpath/core.ts`, `lib/xpath/functions.ts` — ~1,300 LOC).
- Short-circuits common predicates (`contains()`, `starts-with()`) by **pushing them into the PowerShell side** instead of evaluating in JS after enumerating the tree.
- Absolute XPath (`/…`) is automatically rewritten as relative (`./…`) when searching from an element context (controlled by `convertAbsoluteXPathToRelativeFromElement`).
- Unit-tested with **311 XPath cases in 30 groups (515 assertions total)**, covering predicate ordering, axes, functions (`substring`, `sum`, `contains`, `starts-with`, `concat`, `translate`, `floor`, `ceiling`, `round`), OR inside post-position predicates, `!=` on named properties, and W3C spec edge cases.

### 2.2 Rich attribute retrieval via `getProperty`
Resolved in this priority order:
1. Legacy MSAA shorthand aliases — `LegacyName`, `LegacyValue`, `LegacyRole`, `LegacyState`, `LegacyDescription`, `LegacyHelp`, `LegacyKeyboardShortcut`, `LegacyDefaultAction`, `LegacyChildId`
2. `LegacyIAccessible.<Property>` dot-notation
3. **UIA Pattern dot-notation** — `Toggle.ToggleState`, `Value.Value`, `Window.CanMaximize`, `ExpandCollapse.ExpandCollapseState`, `RangeValue.Value`, and 20+ other patterns
4. `"source"` — returns the XML source for the element and its subtree
5. `"all"` — returns all properties as a JSON string
6. Direct UIA properties — `Name`, `AutomationId`, `ClassName`, `RuntimeId`, `ControlType`, `IsEnabled`, `IsOffscreen`, etc.

For Win32/MSAA proxy elements, `getProperty` **automatically falls back** to `LegacyIAccessiblePattern` for `Value.Value`, `Name`, `HelpText`, `AccessKey`, `AcceleratorKey` — implemented by `Get-LegacyPropertySafe` (UIA → MSAA Point → MSAA HWND).

### 2.3 Supported UIA patterns (25+)
`Value`, `Window`, `Transform`, `Transform2`, `Toggle`, `ExpandCollapse`, `RangeValue`, `Selection`, `Selection2`, `SelectionItem`, `Scroll`, `ScrollItem`, `Grid`, `GridItem`, `Table`, `TableItem`, `Dock`, `MultipleView`, `Annotation`, `Drag`, `DropTarget`, `Spreadsheet`, `SpreadsheetItem`, `Styles`, `Text`, `TextChild`, `TextPattern2`, `LegacyIAccessible`, `Invoke`.

### 2.4 Enhanced text input
- **Per-call delay prefix** inside the text string: `[delay:500]Slow text` overrides the session-level `typeDelay` for that single call.
- Modifier keys (Shift, Ctrl, Alt, Meta) are tracked in session-level state and optionally auto-released at the end (`releaseModifierKeys`).
- Unicode **Private Use Area** characters (``–``) are treated as special keys, matching Selenium's `Keys` enum.
- When `SetFocus` fails and text is plain ASCII, falls back to `ValuePattern.SetValue`.

### 2.5 Smooth pointer movement
`smoothPointerMove` capability accepts CSS-like easing names (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`) or a full `cubic-bezier(...)` via the `bezier-easing` package. Applied over `delayBeforeClick` milliseconds.

### 2.6 RawView & element caching
`windows: cacheRequest` exposes the UIA `CacheRequest` object, letting you switch the driver's tree traversal to **RawView** (includes elements normally filtered out of ControlView/ContentView) and cache properties in bulk for a sub-tree.

### 2.7 Screen recording
Built-in FFmpeg recording via `ffmpeg-static` (optional dependency). Produces base64-encoded MP4 output with configurable FPS, time limit, preset, cursor capture, and click capture. x64 only; ARM64 can't use `ffmpeg-static`.

### 2.8 PowerShell script execution
- `execute_script('powerShell', { command | script })` — runs directly against the session's PowerShell process.
- `isolatedScriptExecution` cap — when `true`, each script runs in a fresh process instead of the shared session (avoids polluting session state).
- `prerun` / `postrun` capabilities run PowerShell before/after the session.
- Requires Appium's `power_shell` insecure feature.

### 2.9 App lifecycle control
- `ms:waitForAppLaunch` — seconds to wait after launching before locating the main window (for slow-starting apps).
- `ms:forcequit` — use `Stop-Process -Force` on session end instead of `WindowPattern.Close`.
- `shouldCloseApp` — whether to close the app at session end.
- `appArguments`, `appWorkingDir` — process-launch controls (with `%ENV_VAR%` expansion for `appWorkingDir`).
- `appTopLevelWindow` — attach to an existing window by HWND instead of launching.
- `app: "root"` — target the whole desktop.
- `app: "none"` / omitted — start a session with no app attachment.

---

## 3. Configuration (Capabilities)

| Capability | Type | Default | Purpose |
|---|---|---|---|
| `platformName` | string | — (required) | Must be `"Windows"` |
| `appium:automationName` | string | — (required) | Must be `"NovaWindows2"` |
| `appium:app` | string | — | Exe path, UWP AUMID, `"root"`, or `"none"` |
| `appium:appTopLevelWindow` | string | — | Attach to existing HWND (hex or decimal) |
| `appium:appArguments` | string | — | Launch-time CLI args |
| `appium:appWorkingDir` | string | — | Working dir for the app process |
| `appium:shouldCloseApp` | boolean | `true` | Close app on session end |
| `ms:waitForAppLaunch` | number | `0` | Seconds to wait after launch |
| `ms:forcequit` | boolean | `false` | `Stop-Process -Force` on session end |
| `appium:prerun` / `postrun` | object | — | PowerShell script/command before/after session |
| `appium:isolatedScriptExecution` | boolean | `false` | Run `powerShell` scripts in a fresh process |
| `appium:powerShellCommandTimeout` | number | `60000` | Per-command PowerShell timeout (ms) |
| `appium:smoothPointerMove` | string | — | Easing function for mouse movement |
| `appium:delayBeforeClick` | number | `0` | ms before click (used as movement duration) |
| `appium:delayAfterClick` | number | `0` | ms sleep after click |
| `appium:typeDelay` | number | `0` | ms between each typed character |
| `appium:releaseModifierKeys` | boolean | `true` | Auto-release modifiers after `setValue` |
| `appium:convertAbsoluteXPathToRelativeFromElement` | boolean | `true` | Rewrite `/…` → `./…` in element-scoped XPath |
| `appium:includeContextElementInSearch` | boolean | `true` | Include the context element itself in search |

---

## 4. Locator Strategies (7)

| Strategy | Maps to | Example |
|---|---|---|
| `id` | `RuntimeId` (dot-separated ints) | `42.1234.1.1` |
| `name` | `Name` property | `Save` |
| `xpath` | Full XPath 1.0 on the UIA tree | `//Button[@Name='OK']` |
| `tag name` | `ControlType` name (aliases: `list`→`List∪DataGrid`, `listitem`→`ListItem∪DataItem`) | `Edit` |
| `class name` | `ClassName` property | `RICHEDIT50W` |
| `accessibility id` | `AutomationId` property | `textBox1` |
| `-windows uiautomation` | Raw UIA condition string | `Name=OK` |

A CSS-selector compatibility shim in `processSelector()` silently rewrites `.class`, `#id`, and `*[name="…"]` to the appropriate native strategy (with a warning logged).

---

## 5. Extension Commands (`windows: …`)

Invoked via `driver.execute_script('windows: <name>', args)`.

**Mouse/pointer:** `click`, `hover`, `scroll`, `clickAndDrag`
**Keyboard:** `keys`, `typeDelay`
**UIA patterns:** `invoke`, `expand`, `collapse`, `toggle`, `setValue`, `getValue`, `scrollIntoView`, `setFocus`
**Selection:** `select`, `addToSelection`, `removeFromSelection`, `selectedItem`, `allSelectedItems`, `isMultiple`
**Window:** `maximize`, `minimize`, `restore`, `close`, `setProcessForeground`
**Attributes:** `getAttributes` (JSON dump of all props)
**Caching:** `cacheRequest`
**Clipboard:** `getClipboard`, `setClipboard` (base64; plaintext or PNG image)
**App lifecycle:** `launchApp`, `closeApp`, `deleteFile`, `deleteFolder`
**Recording:** `startRecordingScreen`, `stopRecordingScreen`
**Raw:** `powerShell` (run script/command)

Commands that operate on an element accept it **either** as the first positional argument **or** as `{ elementId: <id> }` inside an options object.

---

## 6. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Appium 3 server                                         │
│    └─ NovaWindows2Driver (extends BaseDriver)            │
│         ├─ commands/                                     │
│         │    ├─ actions.ts    (W3C pointer/keyboard)     │
│         │    ├─ element.ts    (click/setValue/getProp…)  │
│         │    ├─ extension.ts  (windows: * commands)      │
│         │    ├─ powershell.ts (session + executeScript)  │
│         │    ├─ app.ts, file.ts, device.ts, system.ts    │
│         │    └─ screen-recorder.ts (ffmpeg)              │
│         ├─ powershell/                                   │
│         │    ├─ core.ts        (session lifecycle)       │
│         │    ├─ elements.ts    (~928 LOC — UIA wrappers) │
│         │    ├─ conditions.ts  (PropertyCondition, OR…)  │
│         │    ├─ converter.ts   (type marshalling)        │
│         │    ├─ win32.ts       (~513 LOC — Win32 helpers)│
│         │    └─ types.ts, common.ts, regex.ts            │
│         ├─ xpath/                                        │
│         │    ├─ core.ts      (XPath 1.0 → UIA conditions)│
│         │    └─ functions.ts (XPath function library)    │
│         └─ winapi/user32.ts   (DPI awareness via koffi)  │
└──────────────────────────────────────────────────────────┘
                         │  stdin/stdout
                         ▼
┌──────────────────────────────────────────────────────────┐
│  PowerShell child process (persistent per driver session)│
│    └─ System.Windows.Automation + custom cmdlets         │
│       (Find-*, Get-LegacyPropertySafe, MSAAHelper.dll)   │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│  UI Automation / MSAA → target Windows application       │
└──────────────────────────────────────────────────────────┘
```

- **One PowerShell process per driver session** — bound to the instance, not the prototype, so concurrent sessions don't share state.
- **Command queue** (`commandQueue: Promise`) serializes PowerShell I/O.
- **`activeCommands` counter** suppresses Appium's `newCommandTimeout` while a request is in flight.
- **`koffi`** is used for native calls (DPI awareness from `user32.dll`); **`MSAAHelper.dll`** is compiled at runtime from embedded sources.
- `findElOrEls` dispatches to `PropertyCondition` / `OrCondition` objects, serializes them to PowerShell syntax via `buildCommand()`, and parses the PS response back into W3C element refs.

---

## 7. Repository Layout

```
lib/
  driver.ts                 (~325 LOC — main class)
  constraints.ts            (capability constraints)
  constants.ts, enums.ts, util.ts
  commands/                 (~2,900 LOC across 11 files)
  powershell/               (~2,500 LOC across 9 files)
  winapi/user32.ts, winapi/types/
  xpath/core.ts (903 LOC), xpath/functions.ts (404 LOC)
scripts/
  Start_Appium.ps1, build.ps1
  install-openssh.ps1, install_ssh.ps1   (remote-host setup)
  msaa.ps1                               (MSAAHelper source)
  local/, mac/, test/                    (dev helpers)
tests/
  unit/                    mocha + chai specs
    common, conditions, converter, driver, elements,
    getproperty, powershell, wildcard_attr,
    xpath, xpath-comprehensive (445+ PS tests, 515 XPath asserts)
  dev_att/, dev_xpath/, dev_controlType/, dev_24Mar/, debug/
                           (scratch/manual test playgrounds)
docs/                      (Jekyll-published site)
  index, capabilities, finding-elements,
  commands, extensions,
  project-overview, reference,
  releases/
```

**Total LOC in `lib/`**: ~6,600 TypeScript.

---

## 8. Test Coverage

Run with `npm test` (mocha + chai + ts-node).

| Spec file | Scope |
|---|---|
| `xpath-comprehensive.spec.ts` | 311 XPath cases, 30 groups, 515 assertions — parser, predicate ordering, PS-filter optimization, all XPath 1.0 functions, boolean/comparison operators, axes, unions, wildcards |
| `xpath.spec.ts` | Baseline/legacy XPath tests |
| `powershell.spec.ts` | PS command generation |
| `elements.spec.ts` | UIA element wrappers |
| `conditions.spec.ts` | `PropertyCondition`, `OrCondition`, `NotCondition` |
| `converter.spec.ts` | Type marshalling between JS and PowerShell |
| `common.spec.ts` | Shared utilities |
| `driver.spec.ts` | Driver-class behavior (CSS shim, abs→rel XPath, tag aliases) |
| `getproperty.spec.ts` | `getProperty` resolution order |
| `wildcard_attr.spec.ts` | Wildcard attribute matching |

Combined: **445+ PowerShell-side passing tests, 515 XPath assertions**.

---

## 9. Upstream Sync Check

The project is forked from [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver). Upstream has continued to release — here's what has landed there that we haven't merged.

| Upstream version | Date | What landed | Merge-worthy? |
|---|---|---|---|
| **1.4.0** | 2026-04-14 | **WebView2 / Chromium webview automation** (`enableWebView`, `chromedriverExecutablePath`, `edgedriverExecutablePath` caps; proxies into `appium-chromedriver` for native+web context switching). Root-window attachment logic changed. Screen recorder auto-downloads FFmpeg on first use. | ✅ Yes, if web-inside-desktop automation (Electron, WebView2 panes) is in scope. Otherwise optional. |
| **1.3.1** | 2026-03-09 | PowerShell **stderr encoding** configuration fix. Fix for slow-starting classic apps failing to attach during session init. Variable-reference fix. | ✅ Worth pulling — correctness fixes, not feature work. |
| **1.3.0** | 2026-03-06 | Extra W3C commands. `launchApp`/`closeApp`. **`ms:waitForAppLaunch`** + **`ms:forcequit`** (we already have these — landed in our 1.0.0). Per-instance command binding (already present in our `driver.ts`). Unit-test workflow for PRs. | 🟡 Mostly already present in our fork. The GitHub Actions PR-test workflow may be worth copying. |
| **1.2.0** | 2026-01-09 | `"none"` session mode. `appWorkingDir`, `prerun`, `postrun`, `isolatedScriptExecution`. Case-insensitive modifier key handling. | ✅ All of these are **already in our fork's capabilities** — confirmed via `lib/constraints.ts`. |

**Recent upstream commits on `main` worth scanning:**
- `Changed root window attachment logic for compatibility` (Apr 14) — improves reliability when attaching via HWND.
- `Screen recorder ffmpeg auto-download and webview updates` (Apr 14) — removes the hard `ffmpeg-static` dependency by fetching on demand.
- `Fixed current webview configuration issue` (Apr 9)
- `Fixed error when webview endpoint unavailable` (Apr 9)
- `Modified app launch window detection logic` (Apr 9)
- `Resolved CDP port request issue` / `Fixed CDP JSON parsing problem` (Apr 2) — all part of WebView2.
- `Added PowerShell stderr encoding configuration` (Mar 9) — correctness fix.
- `Corrected variable reference error in code` (Mar 9)
- `Implemented unit test workflow for pull requests` (Mar 7) — CI hygiene.

**Recommended pulls (high value, low risk):**
1. **PowerShell stderr encoding** (1.3.1) — encoding fixes tend to surface as odd Unicode bugs under non-English Windows.
2. **Slow-launch attachment fix** (1.3.1) — matters for heavy Win32 apps.
3. **Root-window attachment logic** (1.4.0 commit) — reliability.
4. **GitHub Actions PR test workflow** (1.3.0) — free CI coverage for our 445+ test suite.

**Defer unless needed:** WebView2/Chromedriver integration (1.4.0). Large surface area, pulls in `appium-chromedriver` as a dependency, and is only useful if a test target embeds a Chromium-based WebView.

---

## 10. Applied upstream merges (2026-04-23)

Records the targeted merge of upstream changes into this fork, plus the reasoning for **what was deliberately skipped** so the fork's own improvements were not regressed.

### 10.1 Scope

Upstream has moved ahead in three areas since this fork diverged:

| Upstream area | Upstream ver | Action taken |
| :--- | :--- | :--- |
| W3C window / navigation commands (`title`, `maximizeWindow`, `minimizeWindow`, `back`, `forward`, `closeApp`, `launchApp`) | 1.3.0 | **✅ Merged** (new, additive) |
| `setWindowRect` + `buildMoveCommand` / `buildResizeCommand` on `AutomationElement` | 1.3.0 | **✅ Merged** (new, additive — see §10.2.4) |
| PowerShell stdout/stderr UTF-8 encoding | 1.3.1 | ⏭️ Skipped — fork already does this better (see §10.3.1) |
| Slow-launch app attachment (retry loop + `waitForNewWindow` helper) | 1.3.1 → 1.4.0 | ⏭️ Skipped — fork's attachment logic is more sophisticated (see §10.3.2) |
| Root-window attachment logic changes | 1.4.0 | ⏭️ Skipped — superseded by fork's multi-PID logic |
| WebView2 / Chromium `appium-chromedriver` integration | 1.4.0 | ⏭️ Skipped per user request (out of scope) |
| FFmpeg auto-download in screen recorder | 1.4.0 | ⏭️ Skipped — does not help on ARM64 (no prebuilt binary) |

### 10.2 Changes applied

#### 10.2.1 New driver-level W3C commands

Added to `lib/commands/app.ts` (pure additions — no existing code modified):

| Function | Purpose | W3C endpoint |
| :--- | :--- | :--- |
| `title()` | Returns the `Name` property of the current root window. | `GET /session/:id/title` → `browser.getTitle()` |
| `maximizeWindow()` | Invokes `WindowPattern.SetWindowVisualState(Maximized)` on the root. | `POST /session/:id/window/maximize` → `browser.maximizeWindow()` |
| `minimizeWindow()` | Invokes `WindowPattern.SetWindowVisualState(Minimized)` on the root. | `POST /session/:id/window/minimize` → `browser.minimizeWindow()` |
| `back()` | Sends Alt+Left to the foreground app. | `POST /session/:id/back` → `browser.back()` |
| `forward()` | Sends Alt+Right to the foreground app. | `POST /session/:id/forward` → `browser.forward()` |
| `closeApp()` | Closes the root window via `WindowPattern.Close` and nulls `$rootElement`. | `windows: closeApp` extension |
| `launchApp()` | Relaunches the app from `caps.app` via `changeRootElement`. | `windows: launchApp` extension |

All of these:
- Resolve the current root element through a shared `getRootElementId()` helper that throws `NoSuchWindowError` if no root is attached.
- Reuse existing methods on `AutomationElement` (`buildMaximizeCommand`, `buildMinimizeCommand`, `buildCloseCommand`, `buildGetPropertyCommand`) — **no changes to `powershell/elements.ts`**.
- Reuse existing `keyDown` / `keyUp` helpers from `winapi/user32` with the fork's own `Key` enum for Alt-based navigation.

#### 10.2.2 Extension map updates

In `lib/commands/extension.ts`, added `launchApp` and `closeApp` to `EXTENSION_COMMANDS` so the previously-documented-but-unimplemented `windows: launchApp` / `windows: closeApp` extensions now actually route to the new driver methods.

#### 10.2.4 `setWindowRect` + `TransformPattern` Move / Resize

**`lib/powershell/elements.ts`** — two new template constants alongside the existing window-state templates:

```ts
const MOVE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Move(${1}, ${2})`;
const RESIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Resize(${1}, ${2})`;
```

And two new methods on `AutomationElement` mirroring `buildMaximizeCommand` etc.

**`lib/commands/app.ts`** — driver-level `setWindowRect(x, y, width, height)` that:
1. Resolves the current root element via the shared `getRootElementId()` helper (throws `NoSuchWindowError` if no root is attached).
2. Validates `width` / `height` are non-negative (`InvalidArgumentError` otherwise).
3. Conditionally calls `Move` (when both `x` and `y` are non-null) and/or `Resize` (when both `width` and `height` are non-null).
4. Returns the resulting window rect via the existing `getWindowRect()` method.

This matches the W3C `POST /session/:id/window/rect` shape, so `browser.setWindowRect(x, y, w, h)` in WDIO / Appium clients now works.

### 10.3 What was deliberately NOT merged, and why

#### 10.3.1 PowerShell UTF-8 encoding (upstream 1.3.1)

Upstream 1.3.1's "stderr encoding" fix adds `powerShell.stderr.setEncoding('utf8')`. **The fork already does this** (`lib/commands/powershell.ts:230`), plus more:
- Both `stdout` and `stderr` pinned to UTF-8 at the Node side.
- `SET_UTF8_ENCODING` pins **both** `$OutputEncoding` and `[Console]::OutputEncoding` at the PowerShell side.
- Spawns with `-NoProfile` (upstream does not), which avoids a user's `$PROFILE` polluting output and encoding.

#### 10.3.2 Application attachment logic (upstream 1.3.1 / 1.4.0)

Upstream's `attachToApplicationWindow` only uses `processIds[0]`, calls a `waitForNewWindow` helper, and uses a single-handle path. The fork's version is **materially more robust**:
- Iterates every PID returned by `Get-Process | Sort-Object StartTime -Descending`.
- **Grace period**: for the first 6 retry attempts (~3 s) strictly prioritizes the newest process, preventing mis-attaching to a stale parent window while the real one is still starting.
- Fetches **all** HWNDs per PID via native `getWindowAllHandlesForProcessIds` (user32 `EnumWindows`).
- Per-handle fallback chain: `SetForegroundWindow` → UIA `SetFocus`.

Adopting upstream's simpler version would regress this. Skipped.

#### 10.3.3 Root-window attachment changes (upstream 1.4.0)

Part of the WebView2 rework, tailored to upstream's new dual-context model. Would conflict with the fork's attachment logic in §10.3.2 and serve a feature the fork does not ship.

#### 10.3.4 WebView2 / Chromedriver integration (upstream 1.4.0)

Explicitly out of scope. Merging would require adding `appium-chromedriver` as a dependency, porting class members in `driver.ts`, implementing context switching (`NATIVE_APP` ↔ `WEBVIEW_*`), and new capabilities.

#### 10.3.5 FFmpeg auto-download (upstream 1.4.0)

Upstream 1.4.0 downloads the FFmpeg binary on demand rather than bundling it via `ffmpeg-static`. **There is no prebuilt FFmpeg binary for Windows-on-ARM64**, so this auto-download path doesn't help the fork's target environment. The fork's `optionalDependencies` approach is strictly safer for ARM users.

### 10.4 Verification

| Check | Result |
| :--- | :--- |
| `npm run build` | ✅ Clean (no TS errors) |
| `npm test` (after merge) | ✅ **629 passing, 4 failing** — +35 new tests, all passing. The 4 failures are pre-existing (`getproperty.spec.ts` / `powershell.spec.ts`) and unrelated. |

New test coverage in `tests/unit/elements.spec.ts`, `tests/unit/app.spec.ts` (27 tests for new W3C commands), and `tests/unit/extension-routing.spec.ts` (4 tests confirming `EXTENSION_COMMANDS` wiring).

### 10.5 Future follow-ups

1. If Windows-ARM64 FFmpeg builds become available upstream of `ffmpeg-static`, evaluate upstream 1.4.0's auto-download approach.
2. Re-evaluate WebView2 / Chromedriver integration once a use case appears.
3. Consider upstreaming the fork's `attachToApplicationWindow` to `AutomateThePlanet/appium-novawindows-driver` as a PR.

---

## Appendix: Migration from `appium-windows-driver`

We have successfully migrated our Windows automation infrastructure from the legacy `appium-windows-driver` to `appium-novawindows2-driver`. This transition addresses several critical bottlenecks in performance and reliability.

**Performance & efficiency**
- PowerShell-level XPath filtering optimization (`contains` and `starts-with`)
- Reduced element lookup times via optimized recursive search logic
- Native ARM64 architecture support
- Accelerated application termination with `ms:forcequit` capability
- Optimized app launch synchronization using `ms:waitForAppLaunch`
- Refactored cursor position handling for faster interaction accuracy
- Standardized extension command set for reduced API overhead
- Improved session cleanup efficiency and resource management

**Stability & reliability**
- MSAA/UIA hybrid protection with PID validation
- Auto-focus logic and `SetForegroundWindow` for target elements
- Full W3C XPath 1.0 compliance and validated engine
- Corrected NaN, boolean, and Infinity type coercion logic
- Improved truthiness and type safety for PowerShell responses

**New capabilities**
- Support for UIA RawView and hidden elements
- Integrated screen recording for session debugging
- Enhanced text input with built-in per-action delays
- Smooth mouse pointer movement with Bezier curves
- Native support for 20+ UIA patterns (Toggle, Selection, etc.)

**Deployment notes**
- Seamless setup with no Developer Mode required
- Dynamic runtime compilation of `MSAAHelper.dll`
- Updated capability set for optimized session management

**Capability updates required:**
```json
{
  "platformName": "Windows",
  "automationName": "NovaWindows2",
  "ms:waitForAppLaunch": 3,
  "ms:forcequit": true
}
```
