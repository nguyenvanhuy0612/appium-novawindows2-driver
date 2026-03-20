# Changelog

All notable changes to this project will be documented in this file.

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
