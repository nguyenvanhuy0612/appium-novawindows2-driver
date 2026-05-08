# Enterprise Focus

`appium-novawindows2-driver` is built for **enterprise Windows desktop applications** — the kind of apps that mix UI stacks, accumulate decades of legacy controls, run under non-English locales, and have UI trees with thousands of elements.

This page explains what that focus means in practice. Every claim below is pinned to a specific capability, command, or test.

## What "enterprise" means here

| Concern | Typical pain | What this driver does |
|---|---|---|
| Mixed UI stacks (UWP + WPF + WinForms + Win32) | One driver fails on a control type | UIA-first with MSAA fallback (`getProperty` resolves through 6 layers — see below) |
| Legacy / accessibility-only controls | UIA returns empty `Name`/`Value` for old Win32 widgets | `LegacyIAccessiblePattern` automatic fallback via `Get-LegacyPropertySafe` |
| Deep / dense UI trees | XPath enumeration takes seconds, blocks tests | XPath predicates pushed into PowerShell side; 311 unit-tested cases |
| Hidden / off-tree elements | "Element not found" but it's right there visually | `windows: cacheRequest` exposes `RawView` |
| Non-English / multi-locale environments | Wrong characters typed, dropped keystrokes | `SendInput` with Unicode + per-character `typeDelay` |
| Long-running test suites | One UIA crash kills the rest of the suite | Auto-restart of the PS session (1.1.9+) |
| Apps that take seconds to launch | Driver attaches to wrong window | `ms:waitForAppLaunch` + multi-PID grace period |
| Multiple parallel sessions | State bleeds between sessions | Per-instance state (PS process, command queue, modifier state) |
| Test artefacts (screenshots / video) | Need separate tooling | Built-in `getElementScreenshot`, `windows:startRecordingScreen` |
| ARM64 deployment | Recording binary not available | Recording stack in `optionalDependencies`, lazy-loaded; driver loads on ARM64 either way |

## High-performance XPath

Backed by an in-repo W3C **XPath 1.0** engine in [`lib/xpath/`](../../lib/xpath) (~1,300 LOC).

- Common predicates (`contains()`, `starts-with()`) are **pushed down to PowerShell** instead of being evaluated in JS after enumerating the tree. For `//ListItem[contains(@Name,'Invoice')]` against a 5,000-row list, this is the difference between hundreds of milliseconds and tens of seconds.
- Absolute paths starting from an element context (`element.find_element('xpath', '/Window/Edit')`) are auto-rewritten to relative (`./Edit`) — controlled by `appium:convertAbsoluteXPathToRelativeFromElement`.
- Predicate ordering is faithful to the spec — `[1][contains()]` picks position 1 from the full set first, then tests `contains`. Many drivers get this backwards.
- 311 cases × 515 assertions in [`tests/unit/xpath-comprehensive.spec.ts`](../../tests/unit/xpath-comprehensive.spec.ts) cover predicate ordering, all axes, every XPath 1.0 function, OR inside post-position predicates, `!=` on named properties, and W3C edge cases.

See [Finding Elements](../reference/finding-elements.md) for syntax and examples.

## Rich attribute retrieval (`getProperty`)

A single command — `driver.get_property(element, name)` — resolves attribute reads through six layers in order:

1. **Legacy MSAA shorthand aliases** — `LegacyName`, `LegacyValue`, `LegacyRole`, `LegacyState`, `LegacyDescription`, `LegacyHelp`, `LegacyKeyboardShortcut`, `LegacyDefaultAction`, `LegacyChildId`
2. **`LegacyIAccessible.<Property>` dot-notation** — explicit MSAA pattern read
3. **UIA Pattern dot-notation** — `Toggle.ToggleState`, `Value.Value`, `Window.CanMaximize`, `RangeValue.Value`, `ExpandCollapse.ExpandCollapseState`, and 20+ others
4. **`"source"`** — XML source for the element subtree (debugging)
5. **`"all"`** — all properties as a JSON dump (debugging)
6. **Direct UIA property** — `Name`, `AutomationId`, `ClassName`, `RuntimeId`, `ControlType`, `IsEnabled`, `IsOffscreen`, etc.

For Win32/MSAA proxy elements, the driver **automatically falls back** to `LegacyIAccessiblePattern` for `Value.Value`, `Name`, `HelpText`, `AccessKey`, `AcceleratorKey`. Implemented by `Get-LegacyPropertySafe` which probes UIA → MSAA Point → MSAA HWND.

Net effect: a test reading `element.get_property('Name')` works whether the underlying control is a modern UWP `Button`, an old Win32 button via accessibility proxy, or a custom WPF control with a quirky template.

See [Commands → getProperty](../reference/commands.md#getpropertypropertyname-elementid).

## Wide UIA pattern coverage (25+)

Patterns wired up via either `getProperty('Pattern.Property')` (read) or `windows:` extension commands (invoke):

`Value`, `Window`, `Transform`, `Transform2`, `Toggle`, `ExpandCollapse`, `RangeValue`, `Selection`, `Selection2`, `SelectionItem`, `Scroll`, `ScrollItem`, `Grid`, `GridItem`, `Table`, `TableItem`, `Dock`, `MultipleView`, `Annotation`, `Drag`, `DropTarget`, `Spreadsheet`, `SpreadsheetItem`, `Styles`, `Text`, `TextChild`, `TextPattern2`, `LegacyIAccessible`, `Invoke`.

Where a pattern call fails (e.g. an element doesn't expose `WindowPattern`), the driver translates the raw "Unsupported Pattern" PS error into a clean W3C error so test code gets actionable messages.

See [Extensions → UIA Patterns](../reference/extensions.md#uia-patterns).

## RawView + element caching

Standard UIA traversal runs through `ControlView` or `ContentView`, which **filter out** structural elements (sub-panels, decorative containers, accessibility-irrelevant nodes). For enterprise apps with custom controls, the element you need is often outside that filter.

`windows: cacheRequest` exposes the underlying `CacheRequest` object so callers can:

- Switch to **RawView** (every UIA element, including ones normally hidden)
- Tighten the tree filter (e.g. `IsEnabled=True` only)
- Cache properties in bulk for a sub-tree to avoid round-tripping per-property

```python
driver.execute_script("windows: cacheRequest", [{
    "treeScope": "Subtree",
    "treeFilter": "IsEnabled=True",
    "automationElementMode": "Full",
}])
# subsequent finds + reads use the configured cache
```

See [Extensions → cacheRequest](../reference/extensions.md#cacherequest).

## Robust keyboard input

Keyboard input is the silent killer of cross-locale enterprise tests. This driver:

- Uses **`SendInput`** via koffi, not `keybd_event` — modern API, supports Unicode characters directly without scancode translation. Critical under non-US layouts where ASCII characters require dead-key sequences.
- Tracks **modifier-key state** at the session level (`SHIFT`, `CTRL`, `ALT`, `META` and the right-hand variants `R_SHIFT`, etc.). Releasing a modifier releases its opposite-hand variant too. `Key.NULL` releases all held modifiers and clears the tracked set.
- Optional **per-character delay** via the session-level `appium:typeDelay` capability, or an **inline override**: `element.send_keys("[delay:50]Slow text")` types `"Slow text"` at 50 ms/char regardless of session setting.
- **`SetFocus` failure fallback**: when the focus call fails (which happens on some custom controls), and the text is plain ASCII, falls back to `ValuePattern.SetValue`.
- Modifier-release cleanup is wrapped in `try/finally` — a thrown PS error mid-keystroke doesn't leak a held key into the next test.

See [Capabilities → Interaction](../reference/capabilities.md#interaction-capabilities) and [Commands → setValue](../reference/commands.md#setvaluevalue-elementid).

## Smooth pointer movement

Mouse movement can either be instant (default — `mouseMoveAbsolute` jumps to target) or smooth.

`appium:smoothPointerMove` accepts:

- CSS-like easing names: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`
- Full `cubic-bezier(x1, y1, x2, y2)` syntax via the `bezier-easing` package

Applied over `appium:delayBeforeClick` milliseconds. Useful for triggering hover-only menus, simulating drag-and-drop with realistic animation, or testing UIs that depend on pointer-event ordering.

## Persistent PowerShell session — with auto-restart

The driver maintains **one PowerShell process per Appium session**, owned by the driver instance. Why this matters for enterprise testing:

- **State persists across commands** — `$rootElement`, `$elementTable`, `$cacheRequest` are all session-scoped, so successive finds against the same window are fast.
- **Concurrent sessions don't share state** — no global pollution between parallel test runs.
- **A `commandQueue: Promise` chain serialises I/O** so a test issuing concurrent calls can't race the PS process.
- **Auto-restart** (1.1.9+): if the PS process dies mid-session (e.g. a UIA crash because some script killed `explorer.exe`), the next command transparently re-spawns it via `ensurePowerShellSession`. Stale element IDs surface as `NoSuchElementError` — correct behaviour. The user-visible failure mode "every command after a crash returns `PowerShell session is not available or closed`" no longer happens.

See [Architecture → PowerShell session](../architecture/powershell-session.md) for the full lifecycle.

## App lifecycle control

Real enterprise apps misbehave on launch and shutdown. Capabilities to handle the worst:

| Capability | Why it matters |
|---|---|
| `ms:waitForAppLaunch` | Slow apps spawn child processes for several seconds; the driver retries window-attachment for this many seconds before giving up |
| `ms:forcequit` | Some apps don't honour `WindowPattern.Close` (modal dialogs, splash screens) — `Stop-Process -Force` instead |
| `appium:shouldCloseApp` | Set false when one test launches the app and the next test needs to attach to the still-running instance |
| `appium:appTopLevelWindow` | Attach to an already-running window by HWND — for tests against a manually-launched test fixture |
| `appium:appWorkingDir` | App needs a specific CWD; supports `%ENV_VAR%` expansion |
| `appium:appArguments` | CLI args at launch |
| `app: "root"` | Target the whole desktop (taskbar, Start menu, multi-window scenarios) |
| `app: "none"` | Start a session with no app — for ad-hoc PS scripts, system inspection |

See [Capabilities → Application](../reference/capabilities.md#application-capabilities).

The fork's `attachToApplicationWindow` is **materially more robust** than upstream's:

- Iterates every PID returned by `Get-Process | Sort-Object StartTime -Descending`
- **Grace period**: for the first 6 retry attempts (~3 s) strictly prioritises the newest process, preventing mis-attaching to a stale parent window while the real one is still starting
- Fetches **all** HWNDs per PID via native `getWindowAllHandlesForProcessIds` (user32 `EnumWindows`)
- Per-handle fallback chain: `SetForegroundWindow` → UIA `SetFocus`

## PowerShell escape hatch

For any setup, teardown, or operation the driver doesn't expose directly, `execute_script("powershell", ...)` runs PowerShell in the session.

- **Shared session** (default) — variables persist between calls, so prerequisites accumulate.
- **Isolated session** (`appium:isolatedScriptExecution: true`) — each call spawns a fresh `powershell.exe -NoProfile -Command` process. Use for risky scripts that might destabilise UIA (e.g. anything that touches `Shell.Application` or kills `explorer.exe`) — those go in isolation, the persistent session stays clean.
- **`prerun` / `postrun`** — capability-scoped scripts that run automatically before/after the session.
- Requires Appium's `power_shell` insecure feature flag — enabled via `--allow-insecure power_shell` or `--relaxed-security`.

See [Extensions → PowerShell Escape Hatch](../reference/extensions.md#powershell-escape-hatch).

## Screen recording (x64-only)

`windows: startRecordingScreen` / `stopRecordingScreen` produce base64-encoded MP4 with configurable FPS, time limit, encoder preset, cursor capture, click-highlight overlay, audio input, and arbitrary FFmpeg `-filter:v`.

The recording stack (`ffmpeg-static`, `asyncbox`, `teen_process`) is in `optionalDependencies`, lazy-loaded inside `screen-recorder.ts`. **Why optional**: there's no prebuilt FFmpeg binary for Win-ARM64. On ARM64, omit the stack entirely; the driver loads cleanly and only `windows:startRecordingScreen` fails (with an actionable error message pointing at the missing dependency).

See [Extensions → Screen Recording](../reference/extensions.md#screen-recording).

## Per-instance state isolation

Concurrent Appium sessions get fully-isolated state because the driver binds these per-instance instead of on the prototype:

- The PowerShell child process (`this.powerShell`)
- Stdout/stderr buffers (`this.powerShellStdOut` / `Err`)
- Command queue (`this.commandQueue`)
- Auto-restart promise (`this.powerShellRestartPromise`)
- Modifier-key state (`this.keyboardState`)
- Active-command counter (suppresses Appium's `newCommandTimeout` while a request is in flight)

Run 4 sessions in parallel against 4 VMs with no cross-contamination.

## What this driver is NOT

To set expectations honestly:

- **Not a browser driver.** It does not handle WebView2 / Chromium contexts. The upstream's WebView2 integration was deliberately skipped in this fork (see [Comparison](./comparison.md#deliberately-skipped)). Use the upstream driver if you need native+web context switching.
- **Not a screen-scraping tool.** It uses UIA + MSAA, not OCR or pixel comparison. Apps without accessibility metadata (e.g. raw GDI graphics with no UIA tree) won't be automatable.
- **Not a load-test driver.** One PS process per session is correct for functional testing; it's not the right tool for thousands of concurrent virtual users.

## See also

- [Overview](./overview.md) — what this driver is, fork rationale
- [Comparison](./comparison.md) — vs upstream, vs `appium-windows-driver`, vs WinAppDriver
- [Capabilities](../reference/capabilities.md) — every flag mentioned above
- [Extensions](../reference/extensions.md) — every extension command mentioned above
- [Finding Elements](../reference/finding-elements.md) — XPath, locator strategies, condition DSL
