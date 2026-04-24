# End-to-End Test Plan — appium-novawindows2-driver 1.2.0

Unit tests (880 passing) cover JS-level logic, PS command generation, and validation.
This plan covers **real-world verification** against actual Windows hosts and apps —
the things only an integration test on a live OS can confirm.

---

## 1. Environment Inventory

Fill in once per VM. Keep a snapshot before each E2E run so you can diff against a known-good.

> **Note on creds:** SSH access is key-based (no password prompt). The `admin`
> user is the OpenSSH-authorized account on each VM. Do not commit any real
> passwords here — if you set one for testing, keep it out of this file.

### VM-A — Windows 11
- IP: 192.168.196.132
- SSH: `admin` (key-based auth, passwordless)
- Node.js installed
- Test apps pre-installed: default Windows apps — Calculator, Notepad, Paint…

### VM-B — Windows 10
- IP: 192.168.196.135
- SSH: `admin` (key-based auth, passwordless)
- Node.js installed
- Test apps pre-installed: default Windows apps — Calculator, Notepad, Paint…

### VM-C — Windows Server 2025
- IP: 192.168.196.130
- SSH: `admin` (key-based auth, passwordless)
- Node.js installed
- Test apps pre-installed: default Windows apps — Calculator, Notepad, Paint…

> **Note on Server 2025:** Some UWP/modern apps aren't available on Server SKUs. Budget extra time for adapting UWP tests or substituting classic Win32 equivalents.

---

## 2. Prerequisites — install steps (per VM)

Record the actual commands run so the plan becomes a repeatable setup script.

```powershell
# 1. Install Node.js LTS (v24+) and install Appium 3
npm install -g appium

# 2. copy to VMs, copy via scp to C:\appium, run build remotely. refer to scripts\local\build_deploy_restart.ps1

# 3. Delete previous version of driver if exists and install from local
$p="$env:USERPROFILE\.appium\node_modules"
ri -r -fo -ea 0 "$p\appium-novawindows2-driver","$p\.cache","$p\.package-lock.json"
npm cache clean --force;appium driver install --source=local c:/appium/appium-novawindows2-driver

# 4. Verify install
appium driver list --installed
# expect: novawindows2@1.2.0

# 5. Start refer to scripts\local\Restart_Appium_Remotely.ps1 or wait for script scripts\local\build_deploy_restart.ps1 start complete.
```

Client-side (wherever the test runner executes):

```bash
# Pick ONE client stack per VM (or run the same test script from a central driver).
pip install "Appium-Python-Client"          # Python
# or
npm install -g webdriverio                   # Node
```

Capabilities template — fill the `app` per VM:

```json
{
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": "C:\\Windows\\System32\\notepad.exe",
    "appium:shouldCloseApp": true,
    "appium:powerShellCommandTimeout": 60000,
    "ms:waitForAppLaunch": 3,
    "ms:forcequit": false
}
```

---

## 3. Test Scope

### 3.1 What unit tests already cover (do not re-test here)
- XPath parsing + PS command generation (515 assertions).
- All `windows:` extension command routing.
- Argument validation for every command.
- Boolean coercion across sibling commands.
- Modifier-key release semantics (shift/ctrl/alt/meta round-trips).
- PS-command shape for every builder method.

### 3.2 What only E2E can catch
- Real UIA tree walking + element lookup across different frameworks (UWP/WPF/WinForms/Win32).
- Real keyboard input under different keyboard layouts / IMEs.
- Real `SetForegroundWindow` / `SetFocus` behavior under UAC, Server Session 0, etc.
- Process attach/detach reliability across apps with slow startup.
- Screen resolution + DPI scaling effects on coordinates and screenshots.
- PowerShell session lifecycle under real load (timeouts, kills, stderr encoding).
- Chromium/Edge WebView behavior — **not implemented in 1.2.0**; flag as "N/A" and track for 1.3+ only if needed.

---

## 4. Target-Application Matrix

Pick one canonical app per framework. Re-run the full suite against each on each VM.

| Framework | Win 11 app | Win 10 app | Server 2025 app |
| :--- | :--- | :--- | :--- |
| **UWP** | Calculator (`Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`) | Calculator | _May need substitute — fill in_ |
| **WPF** | _TBD — e.g. XPS Viewer or custom WPF sample_ | _TBD_ | _TBD_ |
| **WinForms** | Notepad (Win 11 22H2+ is UWP; use Classic Notepad or WordPad if still present) | Notepad | Notepad |
| **Win32 (classic)** | Paint (`mspaint.exe`), cmd.exe, regedit, Notepad classic (`notepad.exe`), WordPad (`write.exe`), Character Map (`charmap.exe`), Control Panel (`control.exe`), Task Manager (`taskmgr.exe`), File Explorer (`explorer.exe`), Registry Editor (`regedit.exe`), Services (`services.msc` via `mmc.exe`), Disk Management (`diskmgmt.msc`), System Configuration (`msconfig.exe`), On-Screen Keyboard (`osk.exe`), Magnifier (`magnify.exe`), Snipping Tool legacy (`SnippingTool.exe`), Run dialog (`Win+R`), Windows Media Player legacy (`wmplayer.exe`) | Same (note: some legacy Snipping Tool replaced on Win 11) | Same (Server SKU often lacks Paint/WordPad — substitute cmd.exe + regedit + Notepad) |
| **SecureAge app (real target)** | _Fill in: install path, AUMID if UWP, launch args_ | _Same_ | _Same_ |

### 4.1 Locator discovery workflow

Do NOT guess XPath / AutomationId from memory. For each target element, follow this loop:

1. **Dump the source first** — call `driver.getPageSource()` (or `execute('windows: getAttributes', {elementId: <root>})` for a scoped dump). Save the XML to `E2E_RESULTS/<VM>/<date>/sources/<app>-<screen>.xml` so the run is reproducible.
2. **Inspect the tree** — identify the element by its `AutomationId`, `Name`, `ClassName`, `ControlType`, and position in the tree.
3. **Choose the narrowest reliable locator** — preference order:
   1. `accessibility id` (stable `AutomationId`)
   2. `name` (exact match)
   3. `xpath` with `@AutomationId` or `@Name`
   4. `xpath` with structural axes (only when nothing above is stable)
4. **Verify** — re-run the locator against the live session, then capture `getProperty("all")` of the hit element and diff against the source dump to confirm identity.
5. **Record** — log locator + source path + element `RuntimeId` in `results.json` so later runs can regression-check.

---

## 5. Test Categories

Each category: one client script, run against every app in §4, every VM in §1. Record pass/fail and any logs/screenshots in §7.

### 5.1 Session lifecycle
- [ ] `platformName=Windows` + `automationName=NovaWindows2` + valid `app` — session starts, root attaches.
- [ ] `app: "root"` — desktop attaches, no app launched.
- [ ] `app: "none"` — session starts with `$rootElement = $null`.
- [ ] `appTopLevelWindow` — attach to existing HWND (hex + decimal forms).
- [ ] `app` + `appTopLevelWindow` simultaneously — rejected with `InvalidArgumentError`.
- [ ] Missing Windows platform (if testable) — clear error.
- [ ] `appArguments` / `appWorkingDir` — honoured at launch (check target app receives them).
- [ ] `%ENV_VAR%` expansion in `appWorkingDir` — resolved correctly.
- [ ] `prerun` / `postrun` — PS script runs before/after session.
- [ ] `shouldCloseApp=true` (default) — app closes on session end.
- [ ] `shouldCloseApp=false` — app stays open on session end.
- [ ] `ms:forcequit=true` — `Stop-Process -Force` on session end (verify process gone).
- [ ] `ms:waitForAppLaunch=N` — honoured for slow-starting app.
- [ ] `isolatedScriptExecution=true` — `execute('powershell', ...)` runs in fresh process.
- [ ] `powerShellCommandTimeout` — command exceeding limit raises `TimeoutError`.
- [ ] Concurrent sessions (two drivers) — each gets its own PS process, no state leak.

### 5.2 Locator strategies (all 7)
For each, use Notepad + Calculator to confirm; Win32 + UWP coverage.
- [ ] `accessibility id` — `AutomationId` match.
- [ ] `class name` — ClassName match (Win32 window class).
- [ ] `id` — RuntimeId (`42.1234.1.1`-style).
- [ ] `name` — exact Name match.
- [ ] `tag name` — ControlType (confirm `list`→`List∪DataGrid` alias, `listitem`→`ListItem∪DataItem`).
- [ ] `xpath` — the full matrix:
  - [ ] `//Button[@Name='OK']`
  - [ ] `//*[@AutomationId='foo']`
  - [ ] `contains(@Name, 'abc')`, `starts-with(@Name, 'abc')` (single and multiple, combined with `-and`)
  - [ ] Position predicates: `(//Button)[2]`, `//ListItem[last()]`
  - [ ] `!=` on named properties (@Name, @IsEnabled, @ProcessId)
  - [ ] Axes: `parent::`, `ancestor::`, `descendant::`, `following-sibling::`, etc.
  - [ ] Nested: `//Window[@Name='Notepad']//Edit`
  - [ ] Element-scoped search with absolute XPath — confirm `convertAbsoluteXPathToRelativeFromElement` rewrites correctly.
- [ ] `-windows uiautomation` — `new PropertyCondition(NameProperty, "Calc")`, `new AndCondition(...)`, etc.

### 5.3 Element commands
- [ ] `click()` — real cursor move + mouse down/up, via clickable-point, with rect-center fallback.
- [ ] `click()` with `smoothPointerMove: "ease-in-out"` — visually smooth cursor move (observer-confirmed).
- [ ] `click()` with `delayBeforeClick` / `delayAfterClick` — timing observed.
- [ ] `sendKeys()` plain text.
- [ ] `sendKeys("[delay:500]text")` — per-call delay override.
- [ ] `sendKeys(Keys.CONTROL + "a")` — hot-key; Ctrl properly held and released via cap.
- [ ] `sendKeys()` with non-US keyboard layout — characters correct (the original pain point).
- [ ] `clear()` — field emptied.
- [ ] `getText()`, `getName()`, `getProperty("Name")`, `getProperty("LegacyName")`, `getProperty("Value.Value")`, `getProperty("all")`, `getProperty("source")`.
- [ ] `getElementRect()` — returns root-relative coords; offscreen returns INT32_MAX sentinels (observed).
- [ ] `elementDisplayed`, `elementSelected` (both SelectionItemPattern and TogglePattern paths), `elementEnabled`.
- [ ] `active()` — returns focused element.
- [ ] `getElementScreenshot()` — base64 PNG, decodable.

### 5.4 W3C driver commands (new in 1.2.0)
- [ ] `driver.title` / `browser.getTitle()` — returns the root window's Name.
- [ ] `browser.maximizeWindow()` — root maximizes (visually observed).
- [ ] `browser.minimizeWindow()` — root minimizes.
- [ ] `browser.back()` — Alt+Left fires in a browser / File Explorer / anywhere with nav history.
- [ ] `browser.forward()` — Alt+Right.
- [ ] `browser.setWindowRect(100, 100, 800, 600)` — root moves + resizes.
- [ ] `browser.setWindowRect(null, null, 800, 600)` — resize only.
- [ ] `browser.setWindowRect(100, 100, null, null)` — move only.
- [ ] `browser.setWindowRect(0, 0, 0, 0)` on a non-resizable window — clean error, not a hang.
- [ ] `execute('windows: launchApp')` — app relaunches.
- [ ] `execute('windows: closeApp')` — app closes; `$rootElement` nullified; subsequent `title()` throws `NoSuchWindowError`.
- [ ] No-root state: after `closeApp`, calling `maximizeWindow` / `back` / `title` all throw `NoSuchWindowError`.

### 5.5 Extension commands (`windows: *`)
Cursor / wheel / drag:
- [ ] `windows: click` — all scenarios: elementId only, x/y only, elementId + offset, current cursor position.
- [ ] `windows: click` — `button: right`, `button: middle`, `button: back`, `button: forward`.
- [ ] `windows: click` — `modifierKeys: ['ctrl', 'shift']` (dedupe + both pressed).
- [ ] `windows: click` — `times: 2` with `interClickDelayMs: 10` (double-click).
- [ ] `windows: click` — `durationMs: 500` (long press).
- [ ] `windows: hover` — element to element.
- [ ] `windows: hover` — absolute coords.
- [ ] `windows: scroll` — with `deltaY`, with modifiers.
- [ ] `windows: clickAndDrag` — element to element.
- [ ] `windows: clickAndDrag` — coord to coord with `smoothPointerMove` override.
- [ ] `windows: clickAndDrag` — invalid button → InvalidArgumentError.

Pattern commands:
- [ ] `windows: invoke` on a Button.
- [ ] `windows: expand` / `collapse` on a TreeItem.
- [ ] `windows: toggle` on a CheckBox.
- [ ] `windows: select` / `addToSelection` / `removeFromSelection` / `isMultiple` / `selectedItem` / `allSelectedItems` on a ListBox.
- [ ] `windows: setValue` on an Edit (and a Slider for RangeValuePattern fallback — verify the compound error when neither supports).
- [ ] `windows: scrollIntoView` on an off-screen list item — confirm it scrolls.
- [ ] `windows: maximize` / `minimize` / `restore` / `close` on an element.

System / state:
- [ ] `windows: setClipboard` / `getClipboard` — plaintext roundtrip.
- [ ] `windows: setClipboard` / `getClipboard` — image (PNG) roundtrip.
- [ ] `windows: setProcessForeground` — brings a named process window to the front.
- [ ] `windows: getAttributes` — JSON dump of all UIA properties.
- [ ] `windows: typeDelay` at runtime — subsequent `sendKeys` respects the new delay.
- [ ] `windows: cacheRequest` with named `treeScope: "Descendants"` — **1.2.0 pre-existing bug fix** — confirm no `InvalidArgumentError`.
- [ ] `windows: cacheRequest` with numeric `treeScope: "4"` — also accepted.
- [ ] `windows: cacheRequest` with `treeFilter: "new PropertyCondition(NameProperty, \"x\")"` — applied.
- [ ] `windows: cacheRequest` with `treeFilter: "IsEnabled=True"` (malformed) — fails as `InvalidArgumentError` (new normalization).
- [ ] `windows: keys` — virtual-key code, text, down-only, up-only.

### 5.6 RawView / deep tree
- [ ] Push a cacheRequest with `treeFilter: RawView` — element that was hidden by ControlView becomes findable.
- [ ] Confirm `windows: cacheRequest { treeScope: 'Subtree' }` affects search scope as documented.

### 5.7 PowerShell execution
- [ ] `execute('powerShell', { command: 'Get-Process notepad' })` — returns process list.
- [ ] `execute('powerShell', { script: '$p = ...; $p.Kill()' })` — runs multi-line script.
- [ ] `execute('powerShell', 'Get-Process')` — shorthand form.
- [ ] With `isolatedScriptExecution=true` — modifying session variables (`$rootElement = $null`) does NOT affect subsequent driver commands.
- [ ] With `isolatedScriptExecution=false` — same modification DOES affect the driver session (warning flag: do not use this pattern).
- [ ] Long-running PS that exceeds `powerShellCommandTimeout` — raises `TimeoutError`, process tree killed (verify via Task Manager).

### 5.8 Screen recording (x64 only)
- [ ] `windows: startRecordingScreen` — starts ffmpeg; file appears in temp.
- [ ] `windows: stopRecordingScreen` — returns base64 MP4; file decodes via `ffmpeg -i in.mp4`.
- [ ] `windows: stopRecordingScreen { remotePath: 'http://...' }` — uploads to URL.
- [ ] `fps`, `timeLimit`, `preset`, `captureCursor`, `captureClicks` — each option observable in output.
- [ ] **ARM64 VMs**: `startRecordingScreen` throws the clean "ffmpeg not available" error (no silent hang, no crash).
- [ ] Session-end cleanup — if recording is in progress at session end, it's stopped and the file is rimrafed.

### 5.9 Error surface (validate all still throws W3C-compliant errors)
- [ ] Non-existent element selector — `NoSuchElementError`.
- [ ] `getRootElementId` with no root — `NoSuchWindowError`.
- [ ] Invalid XPath — `InvalidSelectorError`.
- [ ] Negative `width`/`height` in `setWindowRect` — `InvalidArgumentError`.
- [ ] Unknown `windows: foo` command — `UnknownCommandError`.
- [ ] Unsupported pattern (e.g. `windows: toggle` on a Button) — error propagated clearly, session not corrupted.
- [ ] `sendKeys` with no element + no focus — error or falls back cleanly.

### 5.10 Stress / stability
- [ ] 500 consecutive clicks on the same button — no leak, no slowdown.
- [ ] 100-cycle findElement on complex XPath — PS process stays responsive (measure p50/p95 latency).
- [ ] Kill the target app mid-session — subsequent commands raise coherent errors, driver recovers or cleans up.
- [ ] Kill the PS process mid-session — driver detects and either reports or restarts (note actual behavior).
- [ ] Session leaked modifier check — run `sendKeys(Keys.SHIFT + 'abc')` then IMMEDIATELY check `Get-WinSystemState` or observe actual key state (regression for 1.2.0 fix #3).

### 5.11 XPath focus suite (classic Win32 apps)

Precondition for every case: run `getPageSource()` against the target app, save the XML under `sources/`, and pick the locator from the real tree — never hard-code from memory.

Target apps: Paint, Notepad classic, WordPad, cmd.exe host window, regedit, Task Manager, Character Map, Control Panel, File Explorer.

- [ ] **Absolute root path** — `/Window` on each classic app returns the top window; `Name` matches the title bar.
- [ ] **Descendant by AutomationId** — `//*[@AutomationId='<id-from-source>']` on a known control (e.g. Paint ribbon buttons, Notepad `Edit1`) resolves to exactly one element.
- [ ] **Descendant by Name exact** — `//Button[@Name='<name-from-source>']`.
- [ ] **Descendant by ControlType alias** — `//button`, `//edit`, `//menuitem`, `//tabitem`, `//treeitem` each return the expected classic controls.
- [ ] **`contains(@Name, ...)`** — partial title match on a dialog (e.g. Save As variations).
- [ ] **`starts-with(@Name, ...)`** — match ribbon group headers.
- [ ] **Combined predicates with `-and`** — `//Edit[contains(@Name,'Address') and @IsEnabled='True']` in File Explorer.
- [ ] **`!=` predicate** — `//Button[@Name!='Close']` in a toolbar.
- [ ] **Positional `[n]`** — `(//Button)[3]` is stable across two consecutive runs on the same screen.
- [ ] **`last()`** — `//MenuItem[last()]` returns the final menu entry.
- [ ] **Nested absolute** — `//Window[@Name='<app title>']//Edit` returns the edit region.
- [ ] **Axes — `parent::`** — from a Button, `parent::*` returns the containing ToolBar/Pane.
- [ ] **Axes — `ancestor::`** — from a MenuItem, `ancestor::Menu` resolves.
- [ ] **Axes — `descendant::`** — from a Window element, `descendant::Edit` returns all edits.
- [ ] **Axes — `following-sibling::` / `preceding-sibling::`** — navigate between adjacent toolbar buttons.
- [ ] **Element-scoped XPath** — find a Pane, then run `findElement('xpath', '//Button')` against that element. Confirm `convertAbsoluteXPathToRelativeFromElement` rewrites the path (check appium-server.log) and scope is respected.
- [ ] **Element-scoped absolute path** — run `findElement('xpath', '/Window/Pane/Button')` against a non-root element; expect correct rewrite.
- [ ] **No-match XPath** — `//Button[@Name='__nope__']` raises `NoSuchElementError` (not a crash).
- [ ] **Malformed XPath** — `//Button[@Name=` raises `InvalidSelectorError`.
- [ ] **Unicode in Name** — classic app with non-ASCII window title (e.g. rename a file to `тест`, open via File Explorer address bar); `//*[@Name='тест']` matches.
- [ ] **Whitespace / escaping** — names containing `'` (e.g. `Don't Save` dialog) matched via XPath `"..."`-quoted form.
- [ ] **findElements count** — `//Button` count on Paint matches the count observed in the saved source dump.
- [ ] **RawView vs ControlView parity** — push `cacheRequest` with RawView, re-run a given XPath, confirm the hit set is a superset of the ControlView run.

### 5.12 getAttribute / getProperty focus suite

Precondition: pre-dump the source for each app and pick the target elements from the dump. Log every returned value into `results.json` under `attributes.<testcase>`.

- [ ] `getAttribute('Name')` vs `getName()` — identical values on classic controls.
- [ ] `getAttribute('AutomationId')` — matches the AutomationId shown in the source dump.
- [ ] `getAttribute('ClassName')` — matches the Win32 class (e.g. `Edit`, `Button`, `Notepad`).
- [ ] `getAttribute('ControlType')` — human-readable control type string (not the numeric UIA id).
- [ ] `getAttribute('LocalizedControlType')` — localized string on a non-en-US VM (if available).
- [ ] `getAttribute('IsEnabled')` — returns `'True'`/`'False'` string; matches observed UI state (disable a menu item then re-check).
- [ ] `getAttribute('IsOffscreen')` — scroll a list item out of view, re-query, expect `'True'`.
- [ ] `getAttribute('HasKeyboardFocus')` — click into Notepad edit area, re-query.
- [ ] `getAttribute('BoundingRectangle')` — four-number tuple matches `getElementRect()`.
- [ ] `getAttribute('ProcessId')` — equals the PID of the launched target app.
- [ ] `getAttribute('RuntimeId')` — non-empty, stable within a session, changes across sessions.
- [ ] `getAttribute('FrameworkId')` — returns `'Win32'` / `'WinForm'` / `'WPF'` / `'XAML'` / `'DirectUI'` as appropriate per app.
- [ ] `getAttribute('Value.Value')` — on a Notepad Edit after `sendKeys('hello')`, returns `'hello'`.
- [ ] `getAttribute('LegacyIAccessible.Name')` — non-empty on MSAA-proxy classic controls.
- [ ] `getAttribute('LegacyIAccessible.Value')` — populated on classic edits where UIA `Value.Value` is empty.
- [ ] `getAttribute('LegacyIAccessible.Role')` — returns the MSAA role string.
- [ ] `getProperty('all')` — JSON parses cleanly; contains both UIA keys and `LegacyIAccessible.*` keys; all keys observed in the source dump are present.
- [ ] `getProperty('source')` — returns an XML fragment for just that element subtree; re-feedable into XPath search scoped to the element.
- [ ] `windows: getAttributes { elementId, attributes: ['Name','AutomationId','ClassName'] }` — returns only the requested keys.
- [ ] `windows: getAttributes` on an element that has been removed from the tree (e.g. dialog closed between the lookup and the call) — `StaleElementReferenceError`, not a silent null.
- [ ] Unknown attribute name (e.g. `getAttribute('NotAReal.Property')`) — clean error, not a PS stack trace leak.
- [ ] Case-sensitivity probe — `getAttribute('name')` vs `getAttribute('Name')` — record whichever form the driver normalizes, for doc accuracy.
- [ ] Parity check — for every attribute returned by `getProperty('all')`, calling `getAttribute(<key>)` returns the same value (spot-check 10 keys per app).

### 5.13 Legacy / MSAA (Win32-proxy elements)
- [ ] On Win32 MSAA-proxy element (e.g. legacy Win32 dialog), `getProperty("Name")` falls back to LegacyIAccessible when UIA returns empty.
- [ ] `getProperty("LegacyName")`, `getProperty("LegacyValue")`, `getProperty("LegacyRole")` etc. return non-empty on MSAA apps.
- [ ] `getProperty("all")` JSON contains both UIA props and `LegacyIAccessible.*` props.

---

## 6. Per-VM Execution Plan

Run in this order. Later runs build on issues surfaced by earlier ones.

### Round 1 — Smoke test on VM-A (Windows 11)
Scope: §5.1 (lifecycle) + §5.2 XPath happy path + §5.4 (new W3C commands).
Target: Notepad + Calculator.
Time budget: 2 hours.
Outcome: confirm 1.2.0 installs and runs at all.

### Round 2 — Full suite on VM-A
All of §5.* against all apps in §4.
Time budget: 1 day.

### Round 3 — Same suite on VM-B (Windows 10)
Look for 10-vs-11 regressions (notably: `AutomationId` differences, UWP availability, Snip-and-sketch differences).
Time budget: 1 day.

### Round 4 — Server 2025 (VM-C)
Expect these to need adaptation, not just "it works":
- [ ] UWP apps often missing on Server SKUs — substitute or skip.
- [ ] Session 0 isolation (services cannot interact with the desktop) — run the Appium server in an interactive user session, not as a service.
- [ ] Server's default "secure by default" may block `SetForegroundWindow` from background processes — record which commands require the Appium server process to be foreground.
- [ ] Lock-screen on idle — note timeout; disable or extend.
Time budget: 1–2 days.

### Round 5 — Stress + regression bug-watch
Re-run §5.10 on every VM. Collect p50/p95/p99 for findElement latency and PS command round-trip.

---

## 7. Reporting & Artifacts

### Per-run directory layout
Create `E2E_RESULTS/<VM-name>/<YYYY-MM-DD>/` with:

```
E2E_RESULTS/
├─ VM-A-Windows11/
│  └─ 2026-XX-XX/
│     ├─ appium-server.log       # full appium server output
│     ├─ test-runner.log         # client-side log
│     ├─ screenshots/            # captured on every failure
│     │  └─ <testcase>-<ts>.png
│     ├─ screen-recordings/      # windows: startRecordingScreen outputs
│     ├─ powershell-transcripts/ # optional PS transcripts via Start-Transcript
│     └─ results.json            # structured pass/fail per testcase
├─ VM-B-Windows10/
└─ VM-C-Server2025/
```

### `results.json` schema
```json
{
    "vm": "VM-A-Windows11",
    "run_date": "2026-XX-XX",
    "driver_version": "1.2.0",
    "appium_version": "...",
    "node_version": "...",
    "ps_version": "...",
    "target_apps": ["notepad.exe", "Calculator UWP", "..."],
    "categories": {
        "5.1_session_lifecycle": { "total": 16, "passed": 0, "failed": 0, "skipped": 0, "cases": [] },
        "5.2_locators":          { ... },
        "5.3_element_commands":  { ... },
        "5.4_w3c_driver":        { ... },
        "5.5_extensions":        { ... },
        "5.6_rawview":           { ... },
        "5.7_powershell":        { ... },
        "5.8_screen_recording":  { ... },
        "5.9_errors":            { ... },
        "5.10_stress":           { ... },
        "5.11_xpath_focus":      { ... },
        "5.12_attributes_focus": { ... },
        "5.13_legacy_msaa":      { ... }
    },
    "metrics": {
        "find_element_p50_ms": null,
        "find_element_p95_ms": null,
        "ps_roundtrip_p50_ms": null
    },
    "notes": ""
}
```

### Defect triage
Any failure:
1. Capture `appium-server.log` slice covering the failing call (±30 s around the failure timestamp).
2. Screenshot the UI at the failure point.
3. File a GitHub issue on `github.com/nguyenvanhuy0612/appium-novawindows2-driver/issues` with:
   - VM + OS build.
   - Minimal repro script.
   - Failing capability set.
   - Full stack trace (both client + server).
   - Attached artefacts above.

---

## 8. Known Limitations (do not file as bugs)

These are documented trade-offs in 1.2.0:

- **ARM64 screen recording unavailable** — `ffmpeg-static` has no ARM64 binary. `startRecordingScreen` throws a clean error.
- **No WebView2/Chromium automation** — not ported from upstream 1.4.0. Anything running in a Chromium-based WebView inside a desktop app cannot be automated through this driver (yet).
- **`pushCacheRequest` treeFilter requires UIA condition syntax** — shorthand like `Name=OK` is not accepted; use `new PropertyCondition(NameProperty, "OK")` form. Error surface: `InvalidArgumentError`.
- **`sendKeys` special-key sequences are single-hand** — pressing `L_SHIFT` then `R_SHIFT` closes the `L_SHIFT` (1.2.0 fix #3.2). Document this; if round-tripping opposite hands is needed, use explicit up/down via `windows: keys`.

---

## 9. Acceptance Criteria for 1.2.0 Release-to-Production

- ✅ All §5 categories have ≥95% pass rate on at least one primary VM (§ 1).
- ✅ No category has a hard block (category-level pass rate <50%).
- ✅ Every §5.4 (new W3C command) passes on all 3 VMs.
- ✅ §5.10 stress shows no modifier-key leaks after 500 iterations.
- ✅ Regression baseline: run the same suite against 1.1.8 on each VM once; compare 1.2.0 results. Any test passing in 1.1.8 that fails in 1.2.0 blocks release.

---

## 10. Author / Sign-off

| Role | Name | VM | Date | Status |
| :--- | :--- | :--- | :--- | :--- |
| Test lead | _TBD_ | | | |
| VM-A runner | _TBD_ | Windows 11 | | |
| VM-B runner | _TBD_ | Windows 10 | | |
| VM-C runner | _TBD_ | Server 2025 | | |
| Release approver | _TBD_ | | | |
