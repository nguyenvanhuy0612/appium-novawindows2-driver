# Deep Architecture Review

**Status:** Draft · 2026-05-12 · Companion to [`design-review-stable.md`](design-review-stable.md)
**Method:** First-pass read of `lib/xpath/`, `lib/powershell/`, `lib/winapi/`, `lib/commands/screen-recorder.ts`. Cites file:line throughout.

Where [`design-review-stable.md`](design-review-stable.md) tracks the *release-planning* angle (Tier-1/2/3 risk ranking, coverage matrix, roadmap), this doc tracks *what I actually saw in the code* — module-by-module — and updates the recommendations after deeper reading.

---

## 1. Executive deltas vs. the stable-release review

After deep-reading, three claims in the earlier review need adjustment:

| Earlier claim | Updated finding |
|---|---|
| `lib/powershell/win32.ts` is **441 LOC of inline PS in a string** — move to `.ps1` files | More nuanced: it's a PS script *plus* an embedded **C# source**. The C# is compiled on first session start to `lib/dll/Win32Helper.dll` and reused. See [win32.ts:14–29](#powershellwin32ts). Moving to `.ps1` is still good, but the C# already has a caching path. |
| `lib/powershell/elements.ts` is "too complicated" per a TODO | Confirmed at [elements.ts:6](#powershellelementsts). The complexity is concentrated in ~14 embedded TreeWalker scripts + a 200-LOC class doing 30+ "build*" methods. A clean 4-file carve-out exists (§4). |
| Marker collision in 1.1.10 (single `0xF2EE` magic char) | Already fixed in 1.1.11/1.1.12 by per-command UUID — confirmed. |
| 16 pre-existing E2E failures need triage | Done in §5 below. Bucketed: **3 real driver gaps**, **13 test-code drift** against either WDIO v9 or Win11 Notepad. |

---

## 2. PowerShell DSL layer

### `lib/powershell/core.ts` (51 LOC)

The `pwsh` template tag base64-wraps everything in `(Invoke-Expression -Command ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('<btoa>'))))` ([core.ts:22](#powershellcorets)). Properties:

- Every PS command sent through this wrapper grows ~40% (base64 + boilerplate)
- The encoder handles all escaping concerns automatically — single quotes, double quotes, dollar signs, newlines, all safe
- `decodePwsh` ([core.ts:41–51](#powershellcorets)) reverses it for log readability; loops up to 10 levels for nested wrappers
- Commented-out comment-stripping (lines 17–21, 30–34) suggests they considered minifying but kept verbose form — wise for log readability

**Risks**: none material. The 10-level decode cap is fine; nested-base64 PS code is extremely rare.

### `lib/powershell/common.ts` (136 LOC)

Type wrappers that emit PS literals. Key insight on `PSString`:

```ts
// common.ts:14-18
const escapedUnicodeString = value.split('')
    .map((c) => `$([char]0x${c.charCodeAt(0).toString(16).padStart(4, '0')})`)
    .join('');
```

Every char is encoded as a 4-digit hex codepoint. **That's why my e2e unicode tests had to use `psFromCodepoints()` — the driver does the same thing internally.** This is robust but ~17 PS bytes per source char (e.g. 100 chars → 1700 bytes of PS). Worth noting in capacity planning.

**Type wrappers**:

| Wrapper | Validates | Emits |
|---|---|---|
| `PSString` ([common.ts:12](#powershellcommonts)) | accepts anything (no input validation!) | `"$([char]0xNNNN)$([char]0xNNNN)..."` |
| `PSBoolean` ([common.ts:21](#powershellcommonts)) | `typeof === 'boolean'` | `$true` / `$false` |
| `PSInt32` ([common.ts:30](#powershellcommonts)) | `Number.isInteger` | decimal |
| `PSInt32Array` ([common.ts:39](#powershellcommonts)) | array of ints | `[int32[]] @(1, 2, 3)` |
| `PSControlType` ([common.ts:75](#powershellcommonts)) | enum membership; special-cases `semantic zoom` / `app bar` | `[ControlType]::X` |
| `PSPoint`, `PSRect` ([common.ts:95+](#powershellcommonts)) | numeric x/y[/w/h] | `[System.Windows.Point]::new(...)` |
| `PSAutomationElement` ([common.ts:117](#powershellcommonts)) | element has `[W3C_ELEMENT_KEY]` | `FoundAutomationElement` lookup |
| `PSCultureInfo` ([common.ts:127](#powershellcommonts)) | name or numeric LCID | `[CultureInfo]::new(...)` |

**Risks found** (new):
- **`PSCultureInfo` validation has a typo** at [common.ts:131](#powershellcommonts): `typeof nameOrCulture !== 'string' || (typeof nameOrCulture === 'number' && ...)` — the inner clause is dead code because the `||` already passed. Should be `&&`. Low impact (defensive guard rarely fires), but worth fixing.
- **`PSString` accepts ANY input** — no type check, no null-guard. A non-string would coerce via `value.split('')` (TypeError if null/undefined). Minor.

### `lib/powershell/conditions.ts` (168 LOC)

Maps directly to UIA Condition classes. The interesting choice is per-property type checking ([conditions.ts:51–112](#powershellconditionsts)) — `PropertyCondition` knows about Boolean/Int32/String/Int32Array/Point/Rect/ControlType/AutomationElement/Orientation/AutomationHeadingLevel/CultureInfo property categories and demands the right PSObject subclass.

Notable: the OrientationType ↔ AutomationHeadingLevel overlap handling ([conditions.ts:83–105](#powershellconditionsts)) — both enums share the value `NONE`, and the engine accepts either type interchangeably for those properties. Subtle but correct.

`AndCondition` / `OrCondition` require **at least 2** conditions ([conditions.ts:121, 135](#powershellconditionsts)) — single-condition would be redundant.

**Risks**: low. The hierarchy is clean.

### `lib/powershell/elements.ts` (938 LOC) — **the TODO file**

The author's own TODO at [elements.ts:6](#powershellelementsts): *"Move the methods to a separate file, some of them are too complicated and are not easy to maintain"*. Confirmed.

**What's in it:**

| Section | Lines | What |
|---|---|---|
| Axis-aware find scripts | 7–215 | 14 embedded PS TreeWalker scripts for ANCESTOR / PARENT / FOLLOWING / PRECEDING / SIBLING variants × first/all |
| Descendant scripts | 247–254 | `Find-Descendant` / `Find-AllDescendants` (defined in `commands/functions.ts`, called from here) |
| Find-First/Find-All wrappers | 253–254 | Generic `.FindFirst([TreeScope]::X, condition)` |
| Element table I/O | 260–270 | `SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID`, `ELEMENT_TABLE_GET` |
| Property accessor templates | 274–433 | `GET_ELEMENT_PROPERTY`, `GET_ELEMENT_PATTERN_PROPERTY`, `GET_ELEMENT_LEGACY_PROPERTY`, `GET_ALL_ELEMENT_PROPERTIES` |
| Source/rect/screenshot/tagname | 435–632 | Element introspection commands |
| Pattern action templates | 472–632 | 30+ short templates for Invoke/Expand/Collapse/Toggle/Scroll/Maximize/etc. |
| `AutomationElement` class | 658–821 | Wraps a PS expression, exposes `findFirst`/`findAll` + 14 `build*Command` methods |
| `AutomationElementGroup` | 823–838 | Wraps multiple elements as a PS array |
| `FoundAutomationElement` | 840+ | Adds 20+ pattern-action `build*` methods |

**Carve-out proposal** (concrete, no behavior change):

```
lib/powershell/element/
├── automation-element.ts     # AutomationElement, AutomationElementGroup, FoundAutomationElement classes
├── tree-walkers.ts           # FIND_ALL_ANCESTOR ... FIND_ALL_PRECEDING_SIBLING (14 scripts, lines 7–215)
├── element-table.ts          # SAVE_TO_ELEMENT_TABLE_*, ELEMENT_TABLE_GET (lines 260–270)
├── properties.ts             # GET_ELEMENT_PROPERTY, GET_ELEMENT_PATTERN_PROPERTY, GET_ELEMENT_LEGACY_PROPERTY, GET_ALL_ELEMENT_PROPERTIES, GET_ELEMENT_TAG_NAME, GET_ELEMENT_RECT, etc.
├── patterns.ts               # INVOKE_*, EXPAND_*, COLLAPSE_*, TOGGLE_*, SET_ELEMENT_VALUE, GET_ELEMENT_VALUE, etc.
└── index.ts                  # re-exports
```

Effort: ~1 day of mechanical extraction + one round of import updates. **No risk** if the move is byte-faithful — the existing 897 unit tests cover the public surface.

**Why this matters for stable**: future bugs in any one PS script (e.g. a TreeWalker variant) currently require touching the same 938-LOC file that contains every other PS script. A carve-out means future bug fixes are localized.

### `lib/powershell/win32.ts` (513 LOC)

Two pieces fused:
1. A PowerShell preamble (~30 lines) that checks for `lib/dll/Win32Helper.dll` and either loads it OR compiles the embedded C# source ([win32.ts:14–29](#powershellwin32ts))
2. The embedded C# source itself (the rest of the file)

**Key behavior** — the DLL is **cached** ([win32.ts:14–19](#powershellwin32ts)):
- First session: `Win32Helper` type not loaded → script enters the `else` branch, compiles the C# inline
- Subsequent sessions: type IS loaded (since the AppDomain persists across sessions in some PS hosts) OR the compiled DLL exists on disk
- The compiled DLL location is `lib/dll/Win32Helper.dll`, **not** present in the source tree (it's a build artifact)

**Win32Helper class exports** (skimmed from [win32.ts:38–50 doc comment](#powershellwin32ts)):
- Window: `BringToForeground`, `SetTopMost`, `ClearTopMost`, `MinimizeWindow`, `RestoreWindow`, `IsMinimized`, `IsVisible`, `GetWindowText`, `GetWindowRect`, `GetWindowProcessId`
- MSAA: `SetExpectedPid`, `GetLegacyProperty`, `GetLegacyPropertyWithFallback`, `GetLegacyPropsWithFallback`
- P/Invoke targets: `oleacc.dll` (MSAA), `user32.dll` (windowing)

**Risks**:
- **First-session compile latency**: on a clean install, the first session pays for `Add-Type` to compile C#. Cached after.
- **DLL not in git** — the build path is implicit (PS compiles on demand). Deployment via the `.zip` deploy script doesn't include the DLL; each new target compiles afresh.
- **Embedded C# in a TS string** has no syntax checking. A C# typo surfaces at session-create time as a `Add-Type` failure.

---

## 3. XPath layer

### `lib/xpath/core.ts` (904 LOC)

Built on top of the `xpath-analyzer` npm package which produces an AST. The driver's job is to walk that AST and either:
- Convert subtrees to UIA `Condition` (pushed down to PS for efficiency)
- Evaluate subtrees in JS (for XPath functions and arbitrary expressions)

**Entry point**: `xpathToElIdOrIds` ([core.ts:113](#xpathcorets))
- Parses via `new XPathAnalyzer(selector).parse()` ([core.ts:117](#xpathcorets))
- On parse error → throws `InvalidSelectorError` with the parser's message ([core.ts:120](#xpathcorets))
- `mult=false` triggers `OptimizeLastStep` symbol on the last step → upgrades the final `findAll` to `findFirst` (huge perf win for single-element queries)
- If absolute path starts with child axis, upgrades to a custom `CHILD_OR_SELF` axis ([core.ts:144–146](#xpathcorets)) — so `/Window` from root matches the root itself

**`XPathExecutor.processExprNode`** ([core.ts:171–310](#xpathcorets)) is the AST dispatcher. Handles 20+ node types. The most complex paths:

- **Equality / Inequality coercion** ([core.ts:237–275](#xpathcorets)) — implements W3C §3.4 exactly: boolean > number > string with IEEE-754 special-value handling
- **Predicates** ([core.ts:351–540](#xpathcorets)) — the heart of the pushdown optimizer. Tries to convert predicates to PS `PropertyCondition`s; falls back to JS-side filter via `relativeExprNodes`
- **Step execution** ([core.ts:542–675](#xpathcorets)) — handles XPath predicate ordering (pre-position vs. post-position predicates apply in different orders) and offloads simple function-call filters to PS via `setPsFilter`

**Supported axes** ([core.ts:572–613](#xpathcorets)):

| Axis | Status |
|---|---|
| `ancestor`, `ancestor-or-self`, `child`, `descendant`, `descendant-or-self`, `following`, `following-sibling`, `parent`, `preceding`, `preceding-sibling`, `self` | ✅ Implemented |
| `attribute` | ✅ Handled separately ([core.ts:329–335](#xpathcorets)) — returns attribute string values |
| `namespace` | ❌ Returns empty `AutomationElementGroup` ([core.ts:597–598](#xpathcorets)) — UIA has no namespaces |
| Custom `child-or-self` | ✅ Used only as the absolute-path entry rewrite |

**XPath properties allowlist** ([core.ts:85–107](#xpathcorets)): exactly **21 properties** accepted via `@PropName` syntax. Notable omissions:
- `ControlType` — but `name()` and `local-name()` use `LocalizedControlType` (see [core.ts:687](#xpathcorets) tag-name resolution), so users typically reach this via tag-name (`//Button`) rather than attribute
- `BoundingRectangle`, `IsDataItem` — not in list, would fall back to JS-side evaluation
- Pattern properties (`Value.Value`, `Toggle.State`) — not exposed via XPath at all

**Tag-name overloads** ([core.ts:685–700](#xpathcorets)):
- `*` → `TrueCondition()`
- `appbar`, `semanticzoom` → `LOCALIZED_CONTROL_TYPE` literal match (workaround for unsupported ControlType values 50039/50040)
- `list` → `OrCondition(List, DataGrid)`
- `listitem` → `OrCondition(ListItem, …)` (the snippet I read cut off before the second arg)

**Risks found**:
- **List/ListItem tag-name overload** is non-standard XPath. Documentable but surprising — a power user writing `//List` thinks they're matching only `ControlType::List` but also gets DataGrids.
- **0x7FFFFFFF as a `last()` sentinel** ([core.ts:477](#xpathcorets)) — magic number; clearer would be a named constant `POSITION_LAST = Symbol.for('xpath-last')` (inferred fix).
- **No early-termination for the predicate-pushdown decision** — if part of a complex predicate can't push down, the entire thing falls back to JS-side. Acceptable but means writing `[contains(@Name,'x') and @IsEnabled='True']` is slower than `[@IsEnabled='True' and contains(@Name,'x')]` if the second predicate is the more selective one (inferred from the relativeExprNodes accumulation logic).

### `lib/xpath/functions.ts` (404 LOC)

Implements 25 XPath 1.0 functions. **All in JS**, none in PS:

| Function | Coverage | Notes |
|---|---|---|
| `not`, `boolean`, `true`, `false` | ✅ | Standard |
| `concat` | ✅ ([functions.ts:60](#xpathfunctionsts)) | Requires ≥2 args |
| `starts-with`, `contains` | ✅ ([functions.ts:73](#xpathfunctionsts)) | Wildcard (`@*`) supported — checks if ANY attribute matches |
| `count` | ✅ ([functions.ts:121](#xpathfunctionsts)) | |
| `round`, `ceiling`, `floor` | ✅ ([functions.ts:136](#xpathfunctionsts)) | **STRICT** — first arg must be `typeof === 'number'`. **See E2E failure #9–11.** |
| `id` | ✅ ([functions.ts:157](#xpathfunctionsts)) | Uses `RUNTIME_ID` as the identity; splits on `.` |
| `position`, `last` | ✅ ([functions.ts:174](#xpathfunctionsts)) | Reads `contextState` tuple `[pos, last]` |
| `local-name`, `name` | ✅ ([functions.ts:192](#xpathfunctionsts)) | Returns the element's tag-name (LocalizedControlType) |
| `normalize-space` | ✅ ([functions.ts:213](#xpathfunctionsts)) | `.trim().replace(/\s+/g, ' ')` — element arg returns `''` |
| `string-length` | ✅ ([functions.ts:236](#xpathfunctionsts)) | |
| `translate` | ✅ ([functions.ts:259](#xpathfunctionsts)) | Exact W3C semantics |
| `number`, `string` | ✅ ([functions.ts:291](#xpathfunctionsts)) | Coercion |
| `substring`, `substring-before`, `substring-after` | ✅ ([functions.ts:303](#xpathfunctionsts)) | XPath 1-indexed, uses round() per spec |
| `sum` | ✅ ([functions.ts:376](#xpathfunctionsts)) | |
| `text()` | ⚠️ **Always returns empty** ([functions.ts:393](#xpathfunctionsts)) | Comment: *"windows element xml representation never contains text nodes"* |
| `lang()`, `namespace-uri()` | ❌ Not implemented | XPath standard but irrelevant for UIA |

**Risk found** (new):
- **`floor`/`ceiling`/`round` argument coercion gap** ([functions.ts:144–146](#xpathfunctionsts)) — the function rejects any non-`number` argument with `InvalidArgumentError`. Per XPath 1.0, the argument should be implicitly converted via `number()` first. **This is the root cause of pre-existing E2E failures #9, #10, #11** (see §5).

  Suggested fix:
  ```ts
  const resultArray = await processArgs(args[0]);
  const [raw] = resultArray[0];
  const num = typeof raw === 'number' ? raw : convertProcessedExprNodesToNumbers([raw])[0];
  if (Number.isNaN(num) && raw !== undefined) { /* … */ }
  return [Math[mathMethodMap[name]](num) as T];
  ```
  Adds ~3 lines per function. Closes 3 of the 16 known failures.

---

## 4. Win32 / native layer

### `lib/winapi/user32.ts` (909 LOC)

koffi-based FFI. **13 public functions**:

| Function | Purpose |
|---|---|
| `keyDown` / `keyUp` ([user32.ts:783–789](#winapiuser32ts)) | Single-char keyboard events |
| `mouseMoveRelative` ([user32.ts:791](#winapiuser32ts)) | Cursor delta, optional easing curve |
| `mouseMoveAbsolute` ([user32.ts:799](#winapiuser32ts)) | Cursor to point, optional start point + easing |
| `mouseScroll` ([user32.ts:795](#winapiuser32ts)) | Wheel events |
| `mouseDown` / `mouseUp` ([user32.ts:803–809](#winapiuser32ts)) | Button events |
| `getDisplayOrientation` ([user32.ts:811](#winapiuser32ts)) | Screen rotation |
| `setDpiAwareness` ([user32.ts:816](#winapiuser32ts)) | Calls `SetProcessDPIAware()` |
| `getWindowAllHandlesForProcessIds` ([user32.ts:822](#winapiuser32ts)) | Multi-PID window enumeration |
| `trySetForegroundWindow` ([user32.ts:848](#winapiuser32ts)) | Activate a window |
| `showWindow` ([user32.ts:859](#winapiuser32ts)) | Restore/minimize via ShowWindow |
| `findWindowHandle` ([user32.ts:863](#winapiuser32ts)) | Find window by process name |
| `sendKeyboardEvents` ([user32.ts:898](#winapiuser32ts)) | Batched SendInput call |
| `getCursorPosition` ([user32.ts:905](#winapiuser32ts)) | GetCursorPos wrapper |

**Internal helpers** (not exported but worth knowing):
- `charToKeyboardEvents` ([user32.ts:485](#winapiuser32ts)) — char-to-VK mapping with optional Unicode fallback
- `makeMouseMoveEvents` ([user32.ts:431](#winapiuser32ts)) — generates interpolated move events for smooth motion with easing
- `getResolutionScalingFactor` ([user32.ts:746](#winapiuser32ts)) — DPI scaling
- `getScreenResolutionAndRefreshRate` ([user32.ts:756](#winapiuser32ts)) — for normalizing INPUT struct coordinates (SendInput uses 0–65535 normalized coords)

**Struct definitions** ([user32.ts:182–267](#winapiuser32ts)):
- `POINT`, `MOUSEINPUT`, `KEYBDINPUT`, `HARDWAREINPUT`, `INPUT` (with union), `DEVMODEA`
- Layouts match Windows SDK headers. **Not verified on ARM64** — same risk flagged in stable review.

**P/Invoke surface** ([user32.ts:292–308](#winapiuser32ts)): `SendInput`, `GetSystemMetrics`, `SetProcessDPIAware`, `GetDpiForSystem`, `GetCursorPos`, `EnumDisplaySettingsA`, `GetWindowThreadProcessId`, `GetWindowTextA`, `IsWindowVisible` — clean, conventional.

**Risks found** (new vs. stable review):
- The **easing functions** ([user32.ts:167](#winapiuser32ts)) are imported via `bezier-easing` (npm package). The actual easing curve parsing/validation lives in `lib/util.ts:assertSupportedEasingFunction` (referenced from stable review). No new bounds-check risk found at the user32 layer; control points pass through to the bezier library which handles them.
- **No DPI restoration on session end** — `setDpiAwareness` is called once per session in `startPowerShellSession` (via `setupRootElement`). It sets process-wide DPI awareness; never restored. Confirmed concern.

### `lib/winapi/types/*` (skipped detailed read, low risk)

Hardcoded enum tables for VirtualKey, ScanCode, KeyEventFlags, MouseEventFlags, XMouseButton, SystemMetric. Static data; bugs would surface as wrong key behaviour, not crashes.

---

## 5. Triage of the 16 pre-existing E2E failures

Source: `log/smoke_run2.txt` (from the round-1 remote run on 192.168.196.128). Bucketed by root cause:

| # | Test | Root cause | Real bug? | Suggested fix |
|---|---|---|---|---|
| 1 | smoke: reads @Name on root | WDIO v9 changed `getElementAttribute(elementId, name)` to expect the Element, not the id | ❌ test | Use `await el.getAttribute('Name')` |
| 2 | XPath D: equality `@Name="<root-name>"` | Test fetched root name then searched for elements with that name; Win11 Notepad's Name format differs | ❌ test-data drift | Adjust expected match count |
| 3 | XPath D: numeric `@ProcessId > 0` | Same drift, query returned 0 elements | ❌ test-data drift | Same |
| 4 | XPath E: `>` operator | Same | ❌ test-data drift | Same |
| 5 | XPath E: `>=` operator | Same | ❌ test-data drift | Same |
| 6 | XPath F: `[1]` first | Same | ❌ test-data drift | Same |
| 7 | XPath F: `[last()]` | Same | ❌ test-data drift | Same |
| 8 | XPath F: `[position()=1]` | Same | ❌ test-data drift | Same |
| 9 | XPath G: `floor()` | `floor(<non-number>)` rejected before coercion | ✅ **real driver gap** | functions.ts:144 — auto-coerce via `convertProcessedExprNodesToNumbers` |
| 10 | XPath G: `ceiling()` | Same as #9 | ✅ **real driver gap** | Same |
| 11 | XPath G: `round()` | Same as #9 | ✅ **real driver gap** | Same |
| 12 | XPath I: findElement under found element (absolute path) | WDIO v9 `findElementsFromElement` Element arg shape | ❌ test | `await el.findElement(...)` shape |
| 13 | XPath I: absolute XPath rewritten from element scope | Same as #12 | ❌ test | Same |
| 14 | XPath J: malformed XPath → InvalidSelectorError | Test asserts error.name === `InvalidSelectorError`, gets `WebDriverError` (W3C error code is correct) | ❌ test | Match on error.error code, not name |
| 15 | XPath J: unclosed predicate → InvalidSelectorError | Same as #14 | ❌ test | Same |
| 16 | XPath J: findElement with no match → NoSuchElement | WDIO v9 returns lazy Element instead of throwing | ❌ test | Use `$().isExisting()` |

**Summary**: **3 real driver gaps** (#9, #10, #11 — all the same fix), **13 test-code drift** against WDIO v9 or Win11 Notepad UI changes.

**Recommended action**:
1. Fix the floor/ceiling/round coercion ([functions.ts:144–146](#xpathfunctionsts)) — small focused patch
2. Refresh the existing XPath E2E spec to handle WDIO v9 API and Win11 Notepad's UI layout. Useful side-effect: the existing `tests/e2e/xpath.e2e.spec.ts` becomes a reliable regression guard.

---

## 6. Screen recorder

### `lib/commands/screen-recorder.ts` (294 LOC)

Clean module. **ffmpeg via gdigrab** (Windows desktop capture API). Worth knowing:

- ffmpeg invocation ([screen-recorder.ts:165–183](#commandsscreen-recorderts)) — fixed argument list, no user-controlled injection points
- 10-min default time limit ([screen-recorder.ts:46](#commandsscreen-recorderts)), libx264 + zerolatency tune
- Optional-dep loader ([screen-recorder.ts:19–42](#commandsscreen-recorderts)) — `asyncbox` and `teen_process` lazy-loaded with helpful "install with: npm i …" error messages
- Graceful stop ([screen-recorder.ts:233–261](#commandsscreen-recorderts)) — writes `q` to ffmpeg's stdin, 10s timeout, falls back to SIGKILL
- Upload ([screen-recorder.ts:83–103](#commandsscreen-recorderts)) — base64-in-memory if no `remotePath`, else `net.uploadFile` (handles PUT/POST/multipart)

**Risks**:
- **Background process orphaning** ([screen-recorder.ts:195–203](#commandsscreen-recorderts)) — on ffmpeg exit with non-zero, `_enforceTermination` cleans up. But if the *Node process* dies mid-recording, ffmpeg keeps running. There's no cleanup hook on process exit.
- **Disk space** — no max-file-size cap, only `timeLimit` (default 10 min). At default 15 fps libx264 veryfast, ~10 MB/min, so 10 min = ~100 MB. Bounded but not enforced.
- **ARM64**: `ffmpeg-static` may not ship an ARM binary. The `requireFfmpegPath` error message ([screen-recorder.ts:72–80](#commandsscreen-recorderts)) handles this cleanly.

---

## 7. Updated risk register

### Risks confirmed by deep reading

| # | Risk | Module | Severity |
|---|---|---|---|
| 1 | `elements.ts` is a god-file (938 LOC, 30+ embedded scripts) | `lib/powershell/elements.ts` | Tier 1 |
| 2 | Embedded C# in `win32.ts` has no syntax check at build time | `lib/powershell/win32.ts` | Tier 2 |
| 3 | DPI awareness set once, never restored | `lib/winapi/user32.ts:setDpiAwareness` + `lib/powershell/win32.ts` | Tier 3 |
| 4 | ARM64 koffi struct layout untested | `lib/winapi/user32.ts:182+` | Tier 2 |
| 5 | Screen recorder orphans ffmpeg on Node crash | `lib/commands/screen-recorder.ts` | Tier 3 |

### New risks found

| # | Risk | Module | Severity |
|---|---|---|---|
| N1 | **`floor`/`ceiling`/`round` reject non-number args** instead of coercing per XPath 1.0 spec | `lib/xpath/functions.ts:144` | **Tier 1** — root cause of 3 pre-existing failures, small fix |
| N2 | `PSCultureInfo` validation guard has unreachable clause | `lib/powershell/common.ts:131` | Tier 3 |
| N3 | `PSString` accepts non-string input without typecheck (TypeError on null/undefined) | `lib/powershell/common.ts:12` | Tier 3 |
| N4 | XPath `list`/`listitem` tag overloads are non-standard (matches `DataGrid` too) | `lib/xpath/core.ts:690–700` | Tier 3 — document, not fix |
| N5 | Win32Helper DLL not in version control; build is implicit-on-first-session | `lib/powershell/win32.ts` + `lib/dll/` | Tier 2 — explicit build step would harden deploys |
| N6 | XPath property allowlist (21 props) — undocumented; users need to know which fall back to slow JS-side eval | `lib/xpath/core.ts:85` | Tier 2 — needs `docs/reference/finding-elements.md` update |

### Risks revised down after deep reading

| # | Risk in stable review | Updated assessment |
|---|---|---|
| `commands/extension.ts` "god object" | Still valid concern, but the `EXTENSION_COMMANDS` table at line 37 makes the routing dispatch clean. Carve-out is mostly about test isolation, not bug risk. |
| `commands/powershell.ts` race condition in stderr/marker detection | Already fixed in 1.1.12 (per-command UUID marker + dual stdout/stderr marker). Don't re-flag. |

---

## 8. Concrete proposals for next stable

In priority order (lower number = higher leverage):

1. **Fix XPath number coercion** ([functions.ts:144–146, 174–176](#xpathfunctionsts)) — closes 3 of 16 pre-existing failures, ~10 lines.

2. **Carve up `elements.ts`** (§4 above) — ~1 day mechanical work. Targets the file the author themselves flagged. Test coverage is sufficient to make this safe.

3. **Update `tests/e2e/xpath.e2e.spec.ts` for WDIO v9 + Win11 Notepad** — closes the other 13 pre-existing failures. Worth doing because that spec is your most thorough XPath regression guard.

4. **Document the XPath property allowlist** in `docs/reference/finding-elements.md` — the 21 properties from [core.ts:85–107](#xpathcorets), plus a note that other properties work but fall back to slow JS-side evaluation.

5. **Pin a build step for `Win32Helper.dll`** — instead of implicit compile-on-first-session, build into the deploy zip. Faster session start on first connection.

6. **Add a Node-process-exit hook** in `screen-recorder.ts` to kill ffmpeg if Node dies — prevents orphans.

7. **Add an ARM64 smoke job** (or document non-support) — currently the koffi struct definitions assume x64.

8. **Then** consider the `commands/extension.ts` carve-out from the stable review — lower urgency than #1–#6 since the dispatch is already clean.

Estimated total effort to close #1–#5: **3–5 working days** plus one round of CI/regression.

---

## 9. What I did *not* deep-read

Listing so the next pass knows where to focus:

- `lib/commands/element.ts` (391 LOC) — touched briefly during the 1.1.12 fix, not exhaustively re-read
- `lib/commands/extension.ts` (847 LOC) — read the dispatch + a few pattern handlers; did not trace `executeClick`, `executeHover`, `executeClickAndDrag` in full
- `lib/commands/app.ts` (344 LOC) — the app-launch retry loop flagged in the stable review but not deep-read
- `lib/xpath/core.ts` lines 700–904 — read the dispatcher and step executor; did not exhaustively trace `convertNodeTestToCondition` second half, `convertExprNodeToPowerShellFilter`, `optimizeDoubleSlash`
- `lib/powershell/converter.ts` (397 LOC) — Rect/Point/Array converter, low risk
- `lib/powershell/elements.ts` lines 220–630 — the embedded PS scripts beyond the first 100 lines; sampled representative ones but didn't audit every script
- `lib/powershell/win32.ts` lines 80–513 — the embedded C# source itself

If a stable cut depends on full coverage of these, schedule a follow-up read pass.
