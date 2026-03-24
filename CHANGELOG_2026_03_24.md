# Changelog — 2026-03-24

## Summary

- 7 bugs fixed across XPath engine and MSAA property fetching
- 463 unit tests covering full W3C XPath 1.0 spec
- MSAA fallback protection against wrong-window data corruption

---

## Bug Fixes

### 1. `convertProcessedExprNodesToNumbers` destroyed Infinity/NaN/boolean types

**File:** `lib/xpath/functions.ts` (line 397-403)

**Problem:** The function converted everything to string first, then used a regex that only matched finite decimals:
- `Infinity` -> `"Infinity"` -> regex fail -> `NaN`
- `true` -> `"true"` -> regex fail -> `NaN`
- `number(true())` returned `NaN` instead of `1` (W3C §4.4)
- `number(false())` returned `NaN` instead of `0`
- `1 div 0 > 999999` returned `false` (Infinity lost)

**Fix:** Check `typeof item` before string conversion — preserve native numbers (including NaN, Infinity, -Infinity) and convert booleans per W3C (`true->1`, `false->0`).

---

### 2. Equality operator (=, !=) NaN/boolean/Infinity handling

**File:** `lib/xpath/core.ts` (line 236-270)

**Problem:** The operator converted both sides to STRING first, losing original types:
- `NaN = NaN` -> `"NaN" === "NaN"` -> `true` (wrong, IEEE 754 says `false`)
- `NaN != NaN` -> `"NaN" !== "NaN"` -> `false` (wrong, IEEE 754 says `true`)
- `true() = 1` -> `"true" === "1"` -> `false` (wrong, W3C §3.4 says `true`)
- `false() = 0` -> `"false" === "0"` -> `false` (wrong, W3C §3.4 says `true`)

**Fix:** Evaluate raw values first via `processExprNode`, then apply W3C §3.4 type coercion rules in order:
1. If either operand is boolean -> compare as booleans
2. If either operand is number -> compare as numbers (IEEE 754 NaN semantics)
3. Otherwise -> compare as strings
4. Special handling for string-converted NaN/Infinity values

---

### 3. ControlType shows .NET class name in getProperty("all")

**File:** `lib/powershell/elements.ts` (line 358-360 in `GET_ALL_ELEMENT_PROPERTIES`)

**Problem:** `.ToString()` on a `System.Windows.Automation.ControlType` object returned the class name `"System.Windows.Automation.ControlType"` instead of the actual type like `"DataItem"` or `"Button"`.

**Fix:** Added `elseif ($val -is [System.Windows.Automation.ControlType])` branch that uses `$val.ProgrammaticName.Split('.')[-1]` to extract the type name. Same logic already used in `GET_ELEMENT_TAG_NAME`.

---

### 4. MSAA AccessibleObjectFromPoint returns wrong-window properties

**File:** `lib/powershell/elements.ts` (Sections 0, 3, 4 of `GET_ALL_ELEMENT_PROPERTIES` + `GET_ELEMENT_LEGACY_PROPERTY`)

**Problem:** When another window (e.g., PowerShell console) covered the target element, `AccessibleObjectFromPoint(x, y)` silently returned properties from the covering window. This caused:
- `LegacyIAccessible.Name` = `"Administrator: Windows PowerShell"` instead of element name
- `LegacyIAccessible.Role` = `10` (client) instead of `34` (list item)
- Other Legacy properties completely wrong or missing

**Fix — three layers of protection:**

**(a) Section 0: SetForegroundWindow (getProperty "all" only)**
- Before querying properties, walks up the element's ancestor tree to find a window handle
- Calls `ShowWindow` + `SetForegroundWindow` to bring the app to front
- Ensures MSAA point-based fallback hits the correct element

**(b) Section 3: UIA LegacyIAccessiblePattern**
- Added as primary source for Legacy properties before raw MSAA fallback
- Uses `$el.GetCurrentPattern([LegacyIAccessiblePattern]::Pattern)` which communicates through UIA's COM channel — no screen coordinates needed
- Works regardless of window z-order
- Fetches: Name, Value, Description, Role, State, Help, KeyboardShortcut, DefaultAction, ChildId

**(c) Section 4: PID validation on MSAA fallback**
- Before calling `AccessibleObjectFromPoint`, validates that the window at the element's center coordinates belongs to the same process
- Uses `WindowFromPoint` + `GetWindowThreadProcessId` (P/Invoke via PowerShell `Add-Type`)
- If a different process owns that pixel, skips MSAA fallback -> returns `null` instead of wrong data
- Applied to both `GET_ALL_ELEMENT_PROPERTIES` and `GET_ELEMENT_LEGACY_PROPERTY` templates

---

## Test Refactor

**File:** `tests/unit/xpath-comprehensive.spec.ts`

Complete rewrite — **463 tests** organized by W3C XPath 1.0 specification:

| Section | Description | Tests |
|---------|-------------|-------|
| 1.1 | Invalid XPath -> InvalidSelectorError | 10 |
| 1.2 | Execution errors from XPath functions | 4 |
| 2.1 | Axes — command generation (W3C §2.2) | 9 |
| 2.2 | Node Tests — condition generation (W3C §2.3) | 15 |
| 3.1 | Position predicates | 18 |
| 3.2 | Predicate ordering — position then function | 15 |
| 3.3 | Predicate ordering — function then position | 17 |
| 3.4 | Chained multiple predicates | 12 |
| 3.5 | predicateProcessableBeforeNode | 10 |
| 4.1 | Node-Set Functions (last, position, count, id, name) | 15 |
| 4.2 | String Functions (string, concat, starts-with, contains, substring, normalize-space, translate) | 60+ |
| 4.3 | Boolean Functions (boolean, not, true, false) | 24 |
| 4.4 | Number Functions (number, sum, floor, ceiling, round) | 27 |
| 5.1 | Comparison Operators (=, !=, <, >, <=, >=) | 14 |
| 5.2 | Boolean Operators (and, or) | 14 |
| 5.3 | Arithmetic Operators (+, -, *, div, mod) | 20 |
| 5.4 | Union Operator | 6 |
| 6 | Type Coercion (W3C §3.4) | 11 |
| 7.1 | PS filter optimization | 15 |
| 7.2 | INEQUALITY (!=) condition generation | 15 |
| 7.3 | getPropertyAccessor | 21 |
| 8.1-8.5 | OR/AND/not() complex patterns, De Morgan, real-world | 55+ |
| 9 | Edge cases and regression | 9 |
| 10 | NaN and Infinity behavior | 18 |
| 11 | Nested function chains | 19 |
| 12 | Many-condition predicates and stress tests | 20+ |

Key principles:
- Every test exercises **actual code** (`xpathToElIdOrIds`, `XPathExecutor.processExprNode`, `predicateProcessableBeforeNode`), NOT the `xpath-analyzer` library
- Removed all pure `parse()` / AST-inspection tests that only tested the third-party parser
- Includes maximal XPath expression using all operators + all functions in one predicate
- Documents known limitations with comments

---

## Known Limitations (not fixed)

| Issue | Root Cause | Workaround |
|-------|-----------|------------|
| `div`/`mod` right-associative | `xpath-analyzer` parser bug (line 477 in cjs.js — uses recursive descent instead of loop) | Use explicit parentheses: `(10 div 2) mod 3` |
| `AutomationId` empty for Win32 ListView items | PowerShell Core UIA proxy difference vs native UIA | None — platform limitation |
| `IsInvokePatternAvailable` wrong for some elements | PowerShell Core managed UIA differs from native UIA | None — platform limitation |
| `LocalizedControlType` = "item" instead of "list item" | PowerShell Core maps ListItem as DataItem | Existing workaround: OrCondition(ListItem, DataItem) in XPath/tag searches |

---

## Deployment Notes

- MSAAHelper.dll is compiled at runtime on Windows from C# source embedded in `lib/powershell/msaa.ts`
- If C# source changes, delete `build/lib/dll/MSAAHelper.dll` on the Windows machine before restarting appium so it recompiles
- `btoa()` in `lib/powershell/core.ts` cannot handle non-ASCII characters — use ASCII-only in PowerShell template comments (e.g., `-` not `—`)
- Deploy script: `./scripts/mac/build_deploy_restart.sh`
- Debug test: `conda run -n py313 python tests/debug/test_att5.py`
