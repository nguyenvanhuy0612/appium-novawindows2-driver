# Release 1.2.0 — Detailed Change Notes

**Previous release:** 1.1.8
**Scope:** Upstream sync, 7 new W3C standard commands, TransformPattern support, 4 high-impact bug fixes, broad code-quality refactor, +287 new unit tests.

---

## 1. New W3C-standard driver commands

Added to `lib/commands/app.ts`. Each of these is a standard W3C WebDriver command that clients (WebdriverIO, Appium-Python-Client, etc.) invoke directly without `windows:` prefix.

| Command | W3C endpoint | Purpose |
| :--- | :--- | :--- |
| `title()` | `GET /session/:id/title` | Returns the root window's UIA `Name` property. |
| `maximizeWindow()` | `POST /session/:id/window/maximize` | Invokes `WindowPattern.SetWindowVisualState(Maximized)` on the root. |
| `minimizeWindow()` | `POST /session/:id/window/minimize` | Invokes `WindowPattern.SetWindowVisualState(Minimized)` on the root. |
| `back()` | `POST /session/:id/back` | Sends `Alt+Left` to the foreground app. |
| `forward()` | `POST /session/:id/forward` | Sends `Alt+Right` to the foreground app. |
| `setWindowRect(x, y, w, h)` | `POST /session/:id/window/rect` | Moves/resizes the root via `TransformPattern.Move` and `.Resize`. |
| `closeApp()` | `windows: closeApp` extension | Closes the root window via `WindowPattern.Close` and nulls `$rootElement`. |
| `launchApp()` | `windows: launchApp` extension | Relaunches the app from the `app` capability. |

A new private helper `getRootElementId()` is shared by the W3C commands to throw `NoSuchWindowError` consistently when no root is attached.

`windows: launchApp` and `windows: closeApp` are now wired into `EXTENSION_COMMANDS` so the previously-documented-but-unimplemented extensions actually route to the new methods.

## 2. TransformPattern support in the PowerShell core

`lib/powershell/elements.ts` gained two new template constants and two `AutomationElement` methods, parallel to the existing `MAXIMIZE_WINDOW` / `buildMaximizeCommand` pattern:

```ts
const MOVE_WINDOW   = pwsh$ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Move(${1}, ${2})`;
const RESIZE_WINDOW = pwsh$ `${0}.GetCurrentPattern([TransformPattern]::Pattern).Resize(${1}, ${2})`;

class AutomationElement {
    buildMoveCommand(x, y)         { return MOVE_WINDOW.format(this, x, y); }
    buildResizeCommand(width, h)   { return RESIZE_WINDOW.format(this, width, h); }
}
```

These back the new `setWindowRect()` driver method.

## 3. Bug fixes

### 3.1 Stale-rect after `scrollIntoView` in `handleMouseMoveAction` — HIGH

**File:** `lib/commands/actions.ts`

After detecting an off-screen element (all-Infinity rect sentinels) and scrolling it into view, the code re-parsed the **original** JSON string instead of re-fetching the updated rect. The mouse then moved to the stale off-screen coordinates. Fixed by issuing a second `buildGetElementRectCommand` after `scrollIntoView` and parsing its result.

### 3.2 Wrong-hand modifier release in `setValue` — MEDIUM

**File:** `lib/commands/element.ts`

When a user pressed `L_SHIFT`, typed text, then pressed `R_SHIFT` (intending to release the held shift), the code released `R_SHIFT` — the closing char — instead of `L_SHIFT` (the one actually held). Symmetric bug for Ctrl, Alt, Meta. The real modifier leaked until the session-end cleanup. Fixed by releasing `metaKeyStates[key]` (the originally-pressed variant) instead of the closing char. Also refactored the four copy-paste modifier switch-arms into a single `toggleModifier()` closure.

### 3.3 `setValue` modifier leak on error — MEDIUM

**File:** `lib/commands/element.ts`

The `releaseModifierKeys` cleanup block ran only on the happy path. If any inner `sendPowerShellCommand` threw mid-loop, modifiers stayed held into the next command. Fixed by wrapping the char-processing loop in `try/finally`. Per-modifier release errors are caught individually so one failure doesn't mask the originating error.

### 3.4 Inconsistent boolean coercion across sibling commands — LOW

**File:** `lib/commands/element.ts`, `lib/commands/extension.ts`

`elementSelected` used strict-case `=== 'True'` / `=== 'On'`, while `elementDisplayed` / `elementEnabled` / `patternIsMultiple` used `.toLowerCase() === 'true'`. If PowerShell ever emitted `true` / `TRUE` / `on`, `elementSelected` would silently return `false`. All four now use case-insensitive comparison. Also dropped redundant `? true : false` ternaries.

### 3.5 `patternSetValue` error context — LOW

**File:** `lib/commands/extension.ts`

When both `ValuePattern.SetValue` and the `RangeValuePattern` fallback failed, only the RangeValuePattern error surfaced — the user couldn't tell the ValuePattern error was the real story. Now composes an `UnknownError` with both messages.

### 3.6 `pushCacheRequest` selector error type — LOW

**File:** `lib/commands/extension.ts`

`treeFilter` selector-parse errors surfaced as `InvalidSelectorError`, while sibling `treeScope` / `automationElementMode` validations threw `InvalidArgumentError`. Now wrapped in try/catch so all three surface the same error type.

### 3.7 `pushCacheRequest` pre-existing named-scope bug — MEDIUM

**File:** `lib/commands/extension.ts`

Discovered during test writing: the regex-match result used `.groups?.[0]` to access capture group 1, but `.groups` is for named captures only (undefined when no named groups exist). Named `treeScope` values ("Descendants" etc.) never validated; only numeric bitflags worked. Additionally, the range check `Number(x) < min && Number(x) > max` used `&&` instead of `||` so the range was never enforced. Both bugs fixed; `windows: cacheRequest { treeScope: "Descendants" }` now works as documented.

### 3.8 `.groups?.[0]` → proper `[1]` indexing applied to `automationElementMode` as well.

## 4. Code-quality refactor

### 4.1 `parseRectJson()` helper

`lib/util.ts`: new `parseRectJson(raw: string): Rect`. The pattern `JSON.parse(x.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString()))` was repeated **15 times** across 5 files (`actions.ts`, `app.ts`, `element.ts`, `extension.ts`, `xpath/core.ts`). All 15 sites now call the helper.

### 4.2 `withModifierKeys()` helper

`lib/commands/extension.ts`: new `withModifierKeys(modifierKeys, fn)` that presses the listed modifiers, runs `fn()` in a try-block, and releases the modifiers in `finally`. Applied to `executeClick`, `executeHover`, `executeScroll`, `executeClickAndDrag` — replacing ~80 lines of copy-paste `if/keyDown`/`if/keyUp` blocks with 4 one-line wrappers. Side-effect: all four commands now release modifier keys even when an inner call throws, matching the `setValue` cleanup semantics.

### 4.3 `ensureElementResolved()` helper

`lib/commands/extension.ts`: new `ensureElementResolved(driver, elementId)` that performs the `$null -eq`/`RUNTIME_ID`-fallback dance previously duplicated in 6 places (executeClick + 2 sites in executeHover + executeScroll + 2 sites in executeClickAndDrag). Each call site shrank from ~9 lines to 1.

### 4.4 Module-level constants

- `ModifierKeyName` type (exported) replaces 4 inline `('shift'|'ctrl'|'alt'|'win')` unions.
- `MODIFIER_KEY_MAP` replaces 4 repeated if-chains.
- `CLICK_TYPE_BUTTON_MAP` replaces 2 inline 5-line object literals in `executeClick` / `executeClickAndDrag`.

### 4.5 Misc cleanups

- `metaKeyStates` initialization simplified: `shift: undefined, ctrl: undefined, meta: undefined, alt: undefined` → `{}`.
- Renamed `$cx`/`$cy` to `$centerX`/`$centerY` in `GET_ELEMENT_LEGACY_PROPERTY` (kept the short form in `GET_ALL_ELEMENT_PROPERTIES`) to match the test suite's documented naming intent.
- Obsolete `MSAAHelper` class name references updated to `Win32Helper` (the actual class) in tests. `buildBringToFrontCommand` test asserts `BringToForeground` (the actual PS-side wrapper method that internally calls `SetForegroundWindow`).

## 5. Tests

Total: **287 new tests across 9 new spec files** + extensions to 3 existing. Suite went from **594 passing / 4 failing** to **880 passing / 0 failing**.

### New spec files
| File | Tests | Scope |
| :--- | :---: | :--- |
| `util.spec.ts` | 21 | `assertSupportedEasingFunction`, `DeferredStringTemplate`, `$`, `sleep`, `getBundledFfmpegPath` |
| `core.spec.ts` | 12 | `pwsh`/`pwsh$`/`decodePwsh` roundtrip, `PSObject` |
| `regex.spec.ts` | 20 | `RegexItem`, `VarArgsRegexMatcher`, `ConstructorRegexMatcher`, `PropertyRegexMatcher`, `StringRegexMatcher` |
| `app.spec.ts` | 27 | All 7 new W3C commands + `setWindowRect` |
| `element.spec.ts` | 50 | `getProperty` resolution order across all 6 priority levels; `active`, `getName`, `getText`, `clear`, `getElementScreenshot`; boolean coercion; `getElementRect`; `setValue` including modifier bug-fix regressions |
| `actions.spec.ts` | 22 | `performActions` dispatch, pause branches, invalid-type errors, `handleMouseMoveAction` scrollIntoView regression |
| `extension.spec.ts` | 57 | All 14 `pattern*` commands, `pushCacheRequest`, clipboard, `executePowerShellScript`, `typeDelay`, `getAttributes` |
| `extension-routing.spec.ts` | 14 | Full `windows:` → method routing (33 routes) + non-`windows:` paths |
| `extension-validation.spec.ts` | 19 | All coord-pair validations; `executeKeys` validation; `activateProcess` validation; `ensureElementResolved` case-insensitivity |

### Bug-fix regression tests
The four bug fixes each have focused regression tests:
- Stale-rect-after-scrollIntoView: asserts 3 PS calls with rect → scrollIntoView → rect pattern.
- Wrong-hand modifier release: 4 tests (SHIFT/CTRL/ALT/META each L→R round-trip).
- Modifier leak on error: 2 tests (release-on-throw and `releaseModifierKeys=false` inverse).
- Case-insensitive booleans: 4 tests (TRUE/true/ON/on for `elementSelected`).

### Existing-test fixes
Four pre-existing failing tests in `getproperty.spec.ts` and `powershell.spec.ts` were fixed:
- Class name refactor: `MSAAHelper` → `Win32Helper`.
- Variable-name distinction restored: legacy builder uses `$centerX`/`$centerY`, all-props builder keeps `$cx`/`$cy`.
- `buildBringToFrontCommand` expectation updated to the actual PS-side wrapper (`Win32Helper::BringToForeground`).

## 6. Upstream sync

Synchronised relevant changes from [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver) versions 1.3.0 → 1.4.0. Details in `UPSTREAM_MERGE_NOTES.md`. Briefly:

**Merged:** W3C window/navigation commands (1.3.0), `setWindowRect` + TransformPattern (1.3.0).

**Skipped with reason:**
- **WebView2 / Chromium integration** (1.4.0) — out of scope; would pull in `appium-chromedriver` dependency.
- **FFmpeg auto-download** (1.4.0) — no ARM64 FFmpeg binary exists; this fork's optional-dependency approach is strictly safer for ARM users.
- **Upstream's `attachToApplicationWindow`** — the fork's version is materially more robust (multi-PID grace period, all-HWND iteration, dual `SetForegroundWindow` → `SetFocus` fallback).
- **PowerShell stderr encoding fix** (1.3.1) — the fork already pins UTF-8 on both Node and PS sides and uses `-NoProfile`.

## 7. File-level impact

```
lib/commands/actions.ts        |  +11/-5    (bug fix + parseRectJson)
lib/commands/app.ts            | +101/-4    (7 new W3C commands)
lib/commands/element.ts        | +228/-290  (setValue refactor + bool fixes + parseRectJson)
lib/commands/extension.ts      | +407/-556  (withModifierKeys + ensureElementResolved + parseRectJson)
lib/powershell/elements.ts     |  +16/-3    (TransformPattern templates + var rename)
lib/util.ts                    |  +10/ 0    (parseRectJson)
lib/xpath/core.ts              |   +3/-2    (parseRectJson)
tests/unit/                    | ~2700 lines added across 9 new spec files + 3 extended
```

**Net LOC:**
- `lib/` shrank by ~280 lines despite adding 8 W3C commands + 2 builder methods + 3 helpers, via the DRY refactor.
- Test LOC grew substantially (new coverage from 594 → 880 passing tests).

## 8. Documentation artifacts

- `PROJECT_COMPARISON.md` — purpose and feature overview, comparison vs upstream.
- `UPSTREAM_MERGE_NOTES.md` — what was merged, what was skipped, reasoning.
- `CHANGES_1.2.0.md` (this file) — detailed change notes for the release.

## 9. Verification

- `npm run build` — clean, no TypeScript errors.
- `npm test` — **880 passing, 0 failing** (~310 ms).
- Pre-existing failures confirmed fixed; no regressions introduced.
