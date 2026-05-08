# Changelog

All notable changes to this project will be documented in this file.

## [1.1.10] (2026-05-08)

### Bug Fixes

* **Missing runtime dependencies** (`package.json`): `asyncbox` and `teen_process` were imported at runtime by `lib/commands/screen-recorder.ts` but never declared in `dependencies`. They resolved on the developer machine via the broader Appium-ecosystem `node_modules` tree, but a fresh `appium driver install --source=npm appium-novawindows2-driver` on a clean host failed with `Cannot find module 'asyncbox'`, and the driver did not load. Added both packages to `dependencies`.

  Reproduction (1.1.9): `appium driver install --source=npm appium-novawindows2-driver` → start Appium → `Could not load driver 'novawindows2', so it will not be available. Error: Cannot find module 'asyncbox'`.

  No source changes — only `package.json` updated. 1.1.10 is a hotfix for the publish manifest of 1.1.9.

## [1.1.9] (2026-05-08)

This release bundles two batches of work that landed before publish: the upstream-sync + W3C-commands batch (originally tagged "1.2.0" internally) and the code-review-driven hardening batch (PS auto-restart, security, consistency fixes).

### Features

* **PowerShell auto-restart**: `sendPowerShellCommand` now detects a dead persistent PS session (process exited or stdin not writable) and transparently re-runs `startPowerShellSession()` before queueing the next command. Concurrent callers wait on a single shared `powerShellRestartPromise` so a burst of queued commands triggers exactly one restart. The element-table is empty after restart — stale element IDs surface as `NoSuchElementError` (correct behaviour). Replaces the previous failure mode where every command after a PS crash returned "PowerShell session is not available or closed" until `deleteSession`.
* **W3C commands**: Added `title`, `maximizeWindow`, `minimizeWindow`, `back`, `forward`, `setWindowRect`, `closeApp`, `launchApp` at the driver level. Ported from upstream 1.3.0.
* **TransformPattern**: Added `buildMoveCommand` / `buildResizeCommand` on `AutomationElement` (`MOVE_WINDOW` / `RESIZE_WINDOW` templates) — backs `setWindowRect`.
* **Extension routing**: Wired `windows: launchApp` and `windows: closeApp` into `EXTENSION_COMMANDS` (previously documented but unimplemented).
* **`pushFile` payload validation**: `base64Data` is now validated against `^[A-Za-z0-9+/=\s]*$` before interpolation into PowerShell. Closes a PS-injection vector where a crafted "base64" payload could break out of the single-quoted string and execute arbitrary commands in the persistent session.
* **Util**: New `parseRectJson()` helper in `lib/util.ts`, used at 15 previously-duplicated sites across 5 files.
* **Extension helpers**: New `withModifierKeys(modifierKeys, fn)` and `ensureElementResolved(driver, id)` helpers; applied to `executeClick` / `executeHover` / `executeScroll` / `executeClickAndDrag`, replacing ~80 lines of copy-paste modifier handling and ~54 lines of null-check-fallback duplication.

### Bug Fixes

* **EPIPE crash → graceful failure** (`lib/commands/powershell.ts`): registered `stdin.on('error')` and `process.on('exit')` handlers in `startPowerShellSession`. A persistent PS process that dies (e.g. UIA tree walk after `Shell.Application.Quit()` raised `ACCESS_DENIED`) no longer takes down the whole Node host with an unhandled `EPIPE` event. The next command observes the dead session and triggers auto-restart.
* **Negative rect dimensions** (`lib/powershell/converter.ts:189-190`): `Rect(point1, point2)` selectors built width/height via `Math.min(p2[0]-p1[0])` — single-arg `Math.min` returns its input unchanged, so swapped point order produced a negative-dimensioned rect that the PowerShell `[System.Windows.Rect]::new(...)` constructor rejected. Now uses `Math.abs(...)`. Regex groups are coerced to numbers explicitly.
* **`setWindow` foreground after name-based lookup** (`lib/commands/app.ts:85,105`): `handle = Number(nameOrHandle)` is `NaN` when the argument is a window name. `trySetForegroundWindow(NaN)` was a silent no-op, so windows resolved by name stayed in the background. Now fetches the native window handle (`Property.NATIVE_WINDOW_HANDLE`) from the resolved element and passes that.
* **Pattern handlers bypassing element resolution** (`lib/commands/extension.ts`): `patternIsMultiple`, `patternGetSelectedItem`, `patternGetAllSelectedItems`, `patternAddToSelection`, `patternRemoveFromSelection`, `patternSetValue`, `patternGetValue`, and `patternScrollIntoView` accessed `element[W3C_ELEMENT_KEY]` directly. Stale IDs (after session reattach or table eviction) surfaced as raw PowerShell "null-valued expression" errors instead of W3C `NoSuchElementError`. All eight now route through `resolvePatternElement` for consistent error surfacing.
* **UWP path heuristic too loose** (`lib/commands/app.ts:141`): `path.includes('!') && path.includes('_') && !(includes /,\)` accepted any string with `!` and `_` and no separators. Replaced with `^[\w.-]+_[A-Za-z0-9]+![\w.-]+$` matching the actual `<PackageFamilyName>_<PublisherHash>!<AppId>` AUMID shape.
* **`NotCondition` error message** (`lib/powershell/conditions.ts:146`): copy-paste from `AndCondition` made the `InvalidArgumentError` say "AndCondition expects Conditions as args" inside the `NotCondition` constructor. Fixed.
* **`$()` template factory validation** (`lib/util.ts:46`): `if (!Number.isInteger(index) && index < 0)` only threw for indices that were both non-integer AND negative; the constructor used `||` and caught the rest, so the bug was masked. Aligned to `||`.
* **Actions**: `handleMouseMoveAction` used to re-parse the stale off-screen rect JSON after `scrollIntoView` — mouse moved to the original off-screen coords. Now re-fetches the rect.
* **setValue**: Pressing two different-hand modifiers of the same type (e.g. `L_SHIFT` then `R_SHIFT`) released the wrong variant, leaking the originally-held key. Fixed to release the variant that was actually pressed.
* **setValue**: Modifier-release cleanup was outside any try/finally; if a PS command threw mid-loop, modifiers stayed held into the next command. Now wrapped in try/finally; per-modifier release errors are caught individually.
* **Booleans**: `elementSelected` used strict-case `=== 'True'`/`=== 'On'` while sibling booleans used case-insensitive comparison. Now consistent across `elementDisplayed` / `elementEnabled` / `elementSelected` / `patternIsMultiple`.
* **patternSetValue**: When both ValuePattern and RangeValuePattern failed, only the second error surfaced. Now composes both errors so the caller can diagnose.
* **pushCacheRequest (pre-existing bug)**: `.groups?.[0]` on a regex without named captures always returned undefined, so named `treeScope`/`automationElementMode` values ("Descendants", "Full", etc.) never validated — only numeric bitflags worked. Additionally the range check used `&&` where `||` was intended (the range was never enforced). Both fixed.
* **pushCacheRequest**: `treeFilter` selector-parse errors now surface as `InvalidArgumentError` (consistent with sibling validations) instead of `InvalidSelectorError`.

### Refactoring

* **Driver instance state**: added `powerShellRestartPromise?: Promise<void>` field on `NovaWindows2Driver` to dedupe concurrent restart attempts.
* **PS-session helpers**: extracted `isPowerShellAlive(driver)` predicate and `ensurePowerShellSession(driver)` recovery helper in `lib/commands/powershell.ts`.
* **Code quality**: Exported `ModifierKeyName` type (replaces 4 inline unions), added `MODIFIER_KEY_MAP` and `CLICK_TYPE_BUTTON_MAP` module constants (replaces 2 inline object literals).
* **setValue**: Extracted 4 copy-paste modifier switch-arms (~60 lines) into a single `toggleModifier(key, char)` closure.
* **Naming**: Renamed `$cx`/`$cy` to `$centerX`/`$centerY` in `GET_ELEMENT_LEGACY_PROPERTY`; kept short form in `GET_ALL_ELEMENT_PROPERTIES`.
* **Scripts** (`scripts/local/`):
  * `build_deploy_restart.ps1` rewritten with `Invoke-RemotePs` / `Invoke-RemoteScp` helpers (eliminates ~6 inline `[Convert]::ToBase64String` boilerplate blocks); new flags `-SkipBuild`, `-SkipInstall`, `-NoRestart`, `-RestartOnly`; auto-counted step numbering; per-step `$LASTEXITCODE` validation; remote `Write-Host` → `Write-Output` so output renders once (no CLIXML noise, no duplicate lines); new `npm install --omit=dev` step (fixes first-deploy missing-`@appium/base-driver` failure).
  * `copy_log.ps1` rewritten: parameterized `-RemoteHost` / `-RemoteUser` (defaults via `$env:TARGET_*`, matches deploy script); added `-Tail N` and `-Follow` modes; per-host log paths (`log/appium_server-<host>.log`).
  * `Restart_Appium_Remotely.ps1` deleted (obsolete; superseded by `build_deploy_restart.ps1 -RestartOnly`).

### Tests

* **Suite growth**: 594 → **880 passing, 0 failing** (+287 tests).
* **9 new spec files**: `util.spec.ts`, `core.spec.ts`, `regex.spec.ts`, `app.spec.ts`, `element.spec.ts`, `actions.spec.ts`, `extension.spec.ts`, `extension-routing.spec.ts`, `extension-validation.spec.ts`.
* **Pattern-handler tests adjusted**: four `extension.spec.ts` tests (`patternIsMultiple` ×3, `patternSetValue` ×3) updated to account for the new `ensureElementResolved` cache-check call that `resolvePatternElement` now makes before each pattern command — convention is `commands[0]` = cache check (return `'False'` for cache-hit), `commands[1+]` = real pattern calls.
* **Pre-existing failures fixed**: 4 tests in `getproperty.spec.ts` / `powershell.spec.ts` updated to match the `MSAAHelper → Win32Helper` / `SetForegroundWindow → BringToForeground` refactors and the variable-name distinction in the legacy property builder.
* **Regression tests**: each bug fix carries a focused regression test.

### Docs

* **Restructure**: root-level docs consolidated under `docs/` and `tests/`. New layout:
  * `docs/commands.md` — merged `app-commands.md` + `element-commands.md` + `action-sequences.md`.
  * `docs/extensions.md` — merged `extension-commands.md` + `powershell-commands.md` + `screen-recording.md`.
  * `docs/reference.md` — merged `architecture.md` + new `functions.md` (function-level inventory of `lib/`).
  * `docs/project-overview.md` — absorbed `migration_to_novawindows2.md` + `upstream-merge-notes.md`.
  * `docs/releases/1.1.9.md` — moved from root `CHANGES_1.2.0.md` and renamed to match the actual published version.
  * `tests/E2E_TEST_PLAN.md`, `tests/results/`, `tests/analyze/` — moved from root.
* **`docs/index.md`**: TOC restructured into "Usage" + "Internals & Reference" + "Releases" sections.
* **New: `docs/code-review/2026-05-08.md`** — multi-agent static review tracker. 21 findings (3 critical/high, 9 medium, 8 low/notable, 1 PS auto-restart). Per-finding status (🔴 Open / 🟢 Fixed / ✅ False positive). 7 fixes landed this release; 13 remain open as documented follow-ups.

## [1.1.7] (2026-03-20)

### Bug Fixes

* **XPath**: Fixed multiple `contains`/`starts-with` psFilters overwriting each other — now combined with `-and` so all filters apply correctly in PowerShell.

### Tests

* **XPath**: Expanded comprehensive test suite to 311 tests (30 groups, 515 total). Added:
    * G25: OR in post-position predicates (15 tests)
    * G26: AND with mixed conditions (10 tests)
    * G27: not() with complex expressions (10 tests)
    * G28: Chained multiple predicates — 3+ predicates with mixed types (10 tests)
    * G29: Complex real-world patterns from W3C XPath 1.0 spec (15 tests)
    * G30: Boolean conversion edge cases per XPath 1.0 spec (10 tests)

## [1.1.6] (2026-03-20)

### Bug Fixes

* **XPath**: Fixed OR expressions inside post-position predicates — `[6][contains(@Name,'a') or contains(@Name,'b')]` was evaluated as AND instead of OR because both sides were pushed individually to relativeExprNodes. Now the entire OR expression is kept as a single unit for JS-level evaluation.

## [1.1.5] (2026-03-20)

### Bug Fixes

* **XPath**: Fixed predicate ordering — `[N][contains()]` now correctly picks position from the full set first, then tests the function predicate. Previously `contains`/`starts-with` was applied before position filtering, causing `//ListItem[./Text[6][contains(@Name,'[sign]')]]` to return 0 instead of 1.
* **XPath**: Fixed `!=` (INEQUALITY) on named properties (`@Name`, `@IsEnabled`, `@ProcessId`, etc.) — now correctly wraps `PropertyCondition` in `NotCondition`. Previously `!=` behaved identically to `=`.
* **XPath**: Fixed `substring()` to use correct XPath 1.0 one-indexed formula with rounding. Previously used wrong offset causing `substring("12345",2,3)` to return `"345"` instead of `"234"`.
* **XPath**: Fixed `substring()` crash when called with 2 arguments (no count) — `countArg` destructuring failed on `undefined`.
* **XPath**: Fixed `substring-after()` off-by-one with multi-char delimiters — `substring-after("abcdef","cd")` returned `"def"` instead of `"ef"`.
* **XPath**: Fixed `sum()` crash on empty node set — `Array.reduce()` without initial value threw on empty array. Now returns 0 per XPath 1.0 spec.
* **XPath**: Fixed `convertProcessedExprNodesToNumbers` inverted ternary — valid number strings were converted to `NaN` and vice versa, breaking all arithmetic, negation, and comparison operators.
* **PowerShell**: Fixed restrictive regex boundaries that prevented valid UIA property lookups.
* **PowerShell**: Fixed `this` context bind error in `PSRect` and `PSPoint` constructors.
* **Converter**: Fixed `ControlType` mapping by performing robust PowerShell string comparison using `endsWith`.

### Tests

* **XPath**: Added comprehensive XPath test suite (241 tests across 24 groups) covering parsing, predicate ordering, PS filter optimization, condition generation, all XPath functions (substring, sum, contains, starts-with, concat, translate, floor, ceiling, round, etc.), INEQUALITY operator, boolean/comparison operators, complex nested predicates, axes, unions, wildcards, and edge cases.
* **PowerShell**: Significantly expanded unit test suite — total 445 passing tests.

## [1.1.0] (2026-03-17)

### Features

* **XPath**: Optimized `contains` and `starts-with` by pushing filtering to PowerShell.
* **Cursor**: Refactored cursor position handling for better accuracy and fallback.

### Bug Fixes

* **Performance**: Reduced overhead and improved stability of element searches.

## [1.0.10] (2026-03-16)

### Chore

* **Dependencies**: Moved `ffmpeg-static` to `optionalDependencies` for better ARM compatibility.
* **Tests**: Updated unit test paths in `package.json`.

## [1.0.9] (2026-03-13)

### Features

* **Element**: Improved `setValue`, `click`, and `hover` commands with better fallback and robustness.
* **Legacy**: Enhanced `LegacyIAccessible` property retrieval via `Get-LegacyPropertySafe`.

## [1.0.0] (2026-03-08)

### Features

* Added `ms:forcequit` and `ms:waitForAppLaunch` capabilities for better app lifecycle management.
* Integrated Screen Recording support with `windows:startRecordingScreen` and `windows:stopRecordingScreen` commands.
* Standardized extension commands under the `windows:` prefix for better consistency.

### Bug Fixes

* **Critical**: Fixed a truthiness bug in extension commands (click, hover, scroll) where PowerShell string responses ("True"/"False") were incorrectly evaluated in JavaScript.
* Improved robustness of app termination logic in `deleteSession`.
* Fixed various syntax and type issues across the driver.
* Ensured screen recording processes are cleaned up when a session is deleted.

## [0.2.8] (2026-01-07)

### Refactoring

* Unified `LegacyIAccessible` property retrieval using robust fallback logic (UIA -> MSAA Point -> MSAA HWND) via `Get-LegacyPropertySafe` in `elements.ts`.
* Cleaned up PowerShell syntax in `elements.ts`.
* Improved null handling in `Find-ChildrenRecursively`.

## [0.2.7] (2026-01-07)

### Bug Fixes

* Fixed `Unsupported Pattern` exception when closing or maximizing windows that do not support WindowPattern by wrapping in try-catch.

## [0.2.6] (2026-01-07)

### Bug Fixes

* Fixed crash in `findElementFromElement` when using stale elements by validating `ProcessId` access.
* Fixed `You cannot call a method on a null-valued expression` in `GET_ELEMENT_RUNTIME_ID` by adding null check filter.
* Fixed `FIND_DESCENDANTS` crashing with null command input by adding null checks to recursive search commands.
* Implemented `IsReadOnly` fallback for legacy MSAA elements (checking `accState` for `STATE_SYSTEM_READONLY`).
