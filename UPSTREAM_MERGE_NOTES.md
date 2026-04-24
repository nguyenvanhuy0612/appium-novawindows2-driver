# Upstream Merge Notes — 2026-04-23

Source of truth: [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver) (v1.4.0 / April 2026).

This doc records the targeted merge of upstream changes into this fork, plus the reasoning for **what was deliberately skipped** so the fork's own improvements were not regressed.

---

## 1. Scope

Upstream has moved ahead in three areas since this fork diverged:

| Upstream area | Upstream ver | Action taken |
| :--- | :--- | :--- |
| W3C window / navigation commands (`title`, `maximizeWindow`, `minimizeWindow`, `back`, `forward`, `closeApp`, `launchApp`) | 1.3.0 | **✅ Merged** (new, additive) |
| `setWindowRect` + `buildMoveCommand` / `buildResizeCommand` on `AutomationElement` | 1.3.0 | **✅ Merged** (new, additive — see §2.4) |
| PowerShell stdout/stderr UTF-8 encoding | 1.3.1 | ⏭️ Skipped — fork already does this better (see §3.1) |
| Slow-launch app attachment (retry loop + `waitForNewWindow` helper) | 1.3.1 → 1.4.0 | ⏭️ Skipped — fork's attachment logic is more sophisticated (see §3.2) |
| Root-window attachment logic changes | 1.4.0 | ⏭️ Skipped — superseded by fork's multi-PID logic |
| WebView2 / Chromium `appium-chromedriver` integration | 1.4.0 | ⏭️ Skipped per user request (out of scope) |
| FFmpeg auto-download in screen recorder | 1.4.0 | ⏭️ Skipped — does not help on ARM64 (no prebuilt binary) |

---

## 2. Changes applied

### 2.1 New driver-level W3C commands

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

### 2.2 Extension map updates

In `lib/commands/extension.ts`, added `launchApp` and `closeApp` to `EXTENSION_COMMANDS` so the previously-documented-but-unimplemented `windows: launchApp` / `windows: closeApp` extensions now actually route to the new driver methods. README docs are now consistent with implementation.

```ts
const EXTENSION_COMMANDS = Object.freeze({
    // ...existing entries...
    launchApp: 'launchApp',
    closeApp: 'closeApp',
} as const);
```

### 2.4 `setWindowRect` + `TransformPattern` Move / Resize

Added in a follow-up pass after a careful review of `powershell/elements.ts`:

**`lib/powershell/elements.ts`** — two new template constants alongside the existing window-state templates:

```ts
const MOVE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Move(${1}, ${2})`;
const RESIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Resize(${1}, ${2})`;
```

And two new methods on `AutomationElement` mirroring `buildMaximizeCommand` etc.:

```ts
buildMoveCommand(x: number, y: number): string { return MOVE_WINDOW.format(this, x, y); }
buildResizeCommand(width: number, height: number): string { return RESIZE_WINDOW.format(this, width, height); }
```

**`lib/commands/app.ts`** — driver-level `setWindowRect(x, y, width, height)` that:
1. Resolves the current root element via the shared `getRootElementId()` helper (throws `NoSuchWindowError` if no root is attached).
2. Validates `width` / `height` are non-negative (`InvalidArgumentError` otherwise).
3. Conditionally calls `Move` (when both `x` and `y` are non-null) and/or `Resize` (when both `width` and `height` are non-null).
4. Returns the resulting window rect via the existing `getWindowRect()` method.

This matches the W3C `POST /session/:id/window/rect` shape, so `browser.setWindowRect(x, y, w, h)` in WDIO / Appium clients now works.

**Safety notes:**
- `TransformPattern` is a standard UIA pattern — supported by most top-level windows (Win32, WPF, WinForms) via their window providers.
- If a window does not support `TransformPattern` or has `CanMove`/`CanResize` false (e.g., maximized windows), the `Move` / `Resize` PowerShell call will throw; this propagates up as an `UnknownError` from `sendPowerShellCommand`, matching upstream's behavior. No try/catch wrapping was added — this is the same convention used by `MAXIMIZE_WINDOW`, `MINIMIZE_WINDOW`, `RESTORE_WINDOW` in the fork. Only `CLOSE_WINDOW` wraps in try/catch because the no-WindowPattern case is a common expected state for transient/pop-up windows.
- No changes to lookup, caching, or attribute retrieval paths.

### 2.5 Diff summary

```
lib/commands/app.ts          | 99 ++++++++++++++++++++++++++++++++++++++++++++
lib/commands/extension.ts    |  2 ++
lib/powershell/elements.ts   | 10 +++++
3 files changed, 111 insertions(+)
```

---

## 3. What was deliberately NOT merged, and why

### 3.1 PowerShell UTF-8 encoding (upstream 1.3.1)

Upstream 1.3.1's "stderr encoding" fix adds:

```ts
powerShell.stderr.setEncoding('utf8');
```

**The fork already does this** (`lib/commands/powershell.ts:230`), plus more:

- Both `stdout` and `stderr` pinned to UTF-8 at the Node side.
- `SET_UTF8_ENCODING` pins **both** `$OutputEncoding` and `[Console]::OutputEncoding` at the PowerShell side.
- Spawns with `-NoProfile` (upstream does not), which avoids a user's `$PROFILE` polluting output and encoding.

No merge needed; fork is already ahead.

### 3.2 Application attachment logic (upstream 1.3.1 / 1.4.0)

Upstream's `attachToApplicationWindow`:
- Only uses `processIds[0]` (single PID, no prioritization).
- Calls a `waitForNewWindow` helper that blocks up to `ms:waitForAppLaunch` ms.
- Single-handle path.

The fork's `attachToApplicationWindow` is **materially more robust**:
- Iterates every PID returned by `Get-Process | Sort-Object StartTime -Descending`.
- Implements a **grace period**: for the first 6 retry attempts (~3 s) strictly prioritizes the newest process, which prevents mis-attaching to a stale parent window while the real one is still starting.
- Fetches **all** HWNDs per PID via native `getWindowAllHandlesForProcessIds` (user32 `EnumWindows`).
- Per-handle fallback chain: `SetForegroundWindow` → UIA `SetFocus`.

Adopting upstream's simpler version would regress this. Skipped.

### 3.3 Root-window attachment changes (upstream 1.4.0)

These were part of the WebView2 rework (`Changed root window attachment logic for compatibility`) and were tailored to upstream's new dual-context model. They would conflict with the fork's attachment logic in §3.2 and serve a feature the fork does not ship. Skipped.

### 3.4 WebView2 / Chromedriver integration (upstream 1.4.0)

Explicitly out of scope per user direction. Merging would require:
- Adding `appium-chromedriver` as a dependency.
- Porting `CHROMEDRIVER_NO_PROXY`, `chromedriver`, `webviewDevtoolsPort` class members in `driver.ts`.
- Implementing context switching (`NATIVE_APP` ↔ `WEBVIEW_*`).
- New capabilities: `webviewEnabled`, `chromedriverExecutablePath`, `edgedriverExecutablePath`.

Left as a future decision item.

### 3.5 FFmpeg auto-download (upstream 1.4.0)

Upstream 1.4.0 downloads the FFmpeg binary on demand rather than bundling it via `ffmpeg-static`. The problem: **there is no prebuilt FFmpeg binary for Windows-on-ARM64** at the moment, so this auto-download path doesn't help the fork's target environment. The fork's current behavior — treating `ffmpeg-static` as an `optionalDependencies` and throwing a clean "screen recording is not available" when missing — is strictly safer for ARM users. Skipped.

### 3.6 `setWindowRect` / `buildMoveCommand` / `buildResizeCommand` (upstream 1.3.0) — *applied in follow-up*

Initially deferred. **Re-reviewed and applied** — see §2.4 above. The change is a pure addition following the exact pattern of the fork's existing `MAXIMIZE_WINDOW` / `buildMaximizeCommand`, and touches no existing code paths. Build + test suite confirm no regression.

---

## 4. Verification

| Check | Result |
| :--- | :--- |
| `npm run build` | ✅ Clean (no TS errors) |
| `npm test` (before merge) | 594 passing, 4 failing |
| `npm test` (after merge + new tests) | ✅ **629 passing, 4 failing** — +35 new tests, all passing. The 4 failures are pre-existing (`getproperty.spec.ts` / `powershell.spec.ts`) and unrelated to this change, confirmed by `git stash && npm test && git stash pop`. |
| Unmodified areas | XPath engine (`lib/xpath/**`), PowerShell core infrastructure, driver bootstrap (`lib/driver.ts`), session lifecycle (`lib/commands/powershell.ts`), attachment logic (`lib/commands/app.ts::attachToApplicationWindow`) — untouched. |

### 4.1 New unit test coverage

**`tests/unit/elements.spec.ts`** — extended the existing `FoundAutomationElement` suite with 4 new assertions:
- `buildMoveCommand` emits `[TransformPattern]::Pattern .Move(x, y)` with the given coordinates.
- `buildMoveCommand` handles zero and negative coordinates.
- `buildResizeCommand` emits `[TransformPattern]::Pattern .Resize(w, h)` with the given dimensions.
- `buildResizeCommand` embeds the element id into the template.

**`tests/unit/app.spec.ts`** (new file) — 27 tests for the new W3C commands, using a mock driver:
- `title()` — returns the NAME property, issues root-id + NAME reads, throws `NoSuchWindowError` when detached.
- `maximizeWindow()` — emits `WindowPattern.SetWindowVisualState(Maximized)` with the root id, NoSuchWindowError guard.
- `minimizeWindow()` — emits `WindowPattern.SetWindowVisualState(Minimized)`, NoSuchWindowError guard.
- `back()` / `forward()` — NoSuchWindowError guard only (happy path would send real `SendInput` via koffi → user32.dll and press keys on the test machine, so it's intentionally not unit-tested).
- `closeApp()` — issues `Close()` then nulls `$rootElement`, ordering check, NoSuchWindowError guard.
- `launchApp()` — rejects undefined / `"root"` / `"none"` (case-insensitive), delegates to `changeRootElement` on the happy path.
- `setWindowRect()` — all four null-combination paths (Move-only, Resize-only, both, neither), validation (negative w/h), no-root guard, Move-before-Resize ordering, return value from `getWindowRect`.

**`tests/unit/extension-routing.spec.ts`** (new file) — 4 tests confirming the `EXTENSION_COMMANDS` wiring:
- `windows: launchApp` → `launchApp` driver method.
- `windows: closeApp` → `closeApp` driver method.
- Unknown `windows: <name>` still throws `UnknownCommandError`.
- Positional args are forwarded to the target method.

---

## 5. Future follow-ups (not done in this pass)

1. If Windows-ARM64 FFmpeg builds become available upstream of `ffmpeg-static`, evaluate upstream 1.4.0's auto-download approach.
2. Re-evaluate WebView2 / Chromedriver integration once a use case appears.
3. Decide whether to upstream the fork's superior `attachToApplicationWindow` to `AutomateThePlanet/appium-novawindows-driver` as a PR — it would benefit all users of that driver.
