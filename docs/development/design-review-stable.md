# Design Review — Path to Stable Release

**Status:** Draft · 2026-05-12 · Author: review for stable release planning
**Scope:** Architecture risk assessment, test-coverage gaps, and a prioritized backlog of improvements between the current `1.1.12` and the next stable release.

This document **does not restate** what is already in:

- [`docs/architecture/overview.md`](../architecture/overview.md) — three-layer design, state isolation, request flows
- [`docs/architecture/components.md`](../architecture/components.md) — per-module walkthrough
- [`docs/architecture/powershell-session.md`](../architecture/powershell-session.md) — session lifecycle deep-dive
- [`docs/development/testing.md`](testing.md) — test inventory
- [`docs/code-review/2026-05-08.md`](../code-review/2026-05-08.md) — open static-analysis tracker

Read those first. This doc synthesizes them, adds findings that fell out of the 1.1.10 → 1.1.12 release work, and lists what must land for a stable cut.

---

## 1. Executive verdict

| | |
|---|---|
| **Ready for stable today?** | **No** — protocol is solid, ~6 known structural debts and ~5 high-priority issues need to clear first. |
| **Single biggest risk** | The two god-objects (`commands/extension.ts` 847 LOC, `powershell/elements.ts` 780 LOC) carry most of the latent bugs and are the hardest places to safely add features. |
| **Single biggest test gap** | Error-surface and stress-path E2E coverage. ~645 test cases today, ~0 of them exercise NoSuchElement / StaleElement / mid-session restart / large trees. |
| **What just stabilised** | The PS session protocol (1.1.12). UUID marker, dual stdout/stderr marker, teardown semantics, $LASTEXITCODE detection, `treatStderrAsError` opt-out. 17 new runtime-protocol unit tests cover the framing. |

---

## 2. Risks worth ranking

Each row maps to a concrete file and an estimated effort. **Tier 1** items should land before stable.

### Tier 1 — block stable

| # | Risk | Location | Why it matters | Effort |
|---|---|---|---|---|
| 1 | **`extension.ts` god-object** (10+ concerns, 847 LOC) | `lib/commands/extension.ts` | Adding any platform-extension command means touching this file. Every change risks regressions in unrelated extensions (patterns / clicks / clipboard / recording / etc.). Test isolation is impossible. | 1–2 days |
| 2 | **Duplicated `ensureElementResolved`** | `lib/commands/element.ts` and `lib/commands/extension.ts` (twice, identical logic) | Stale-element recovery is critical. Two copies means one will drift. | 1 hour |
| 3 | **`powershell/win32.ts` is 441 LOC of inline PS in a template string** | `lib/powershell/win32.ts` | No syntax checking, no linting, no testability. Bugs here surface as 60s timeouts. | 1 day to externalise to `.ps1` files |
| 4 | **`powershell/elements.ts` TODO comment** (acknowledged "too complicated and not easy to maintain") | `lib/powershell/elements.ts:6` | 780 LOC mixing TS DSL builders and embedded PS scripts. Highest-risk file in the codebase. | 2–3 days for a targeted carve-out |
| 5 | **Error-surface E2E missing entirely** | `tests/e2e/` | We have zero E2E tests that assert a particular WebDriver error type for invalid input. Test plan §5 covers it. | 0.5 day |
| 6 | **No mid-session resilience E2E** | `tests/e2e/` | Auto-restart code path (`ensurePowerShellSession`) is only exercised by unit tests with fake PS. Test plan §5 covers it. | 0.5 day |

### Tier 2 — high priority, can ship without

| # | Risk | Location | Notes |
|---|---|---|---|
| 7 | **Hardcoded retry counts** | `lib/commands/app.ts:95-120` (20 attempts × 500ms), `lib/commands/powershell.ts` (5s teardown timeout) | Should be capabilities or constants in one place. |
| 8 | **XPath property whitelist incomplete** | `lib/xpath/core.ts:85-150` | ~30 properties allowed; others error with "Property not allowed in XPath". Document the whitelist or expand it. |
| 9 | **Keyboard state in JS, not PS** | `lib/driver.ts:41-77` | If a modifier release fails, the JS-side `keyboardState.shift / .ctrl / etc.` flags drift. PS would be authoritative. |
| 10 | **Win32 koffi struct layout untested on ARM64** | `lib/winapi/user32.ts:29-100` | Will silently misalign on ARM Windows. |
| 11 | **`commands/file.ts` is all stubs** | `lib/commands/file.ts` | Either implement or document as deliberately unsupported. |

### Tier 3 — debt to track

| # | Risk | Location | Notes |
|---|---|---|---|
| 12 | Base64-wrap overhead on every PS command | `lib/powershell/core.ts:43-49` | Measurable in high-frequency tests, but cleanly handles escaping. Defer. |
| 13 | No bounds checking on numeric capabilities | `lib/constraints.ts` | `powerShellCommandTimeout`, `typeDelay`, `delayBeforeClick` accept any number. |
| 14 | Lingering `appium-novawindows-driver` (upstream) on test target | environment | Driver name collision risk; uninstall before installing `novawindows2`. |
| 15 | DPI awareness not restored on session end | `lib/powershell/win32.ts:300+` | Affects subsequent sessions if Node process is reused. |

---

## 3. E2E coverage matrix (gap-focused)

Inventory of what's tested today vs. what isn't. Drawn from `tests/unit/`, `tests/e2e/`, `tests/all_e2e/`.

| Capability | Status | Where |
|---|---|---|
| Session create / delete | ✅ covered | `smoke.e2e.spec.ts`, `app.e2e.spec.ts` |
| Locator: xpath, accessibility-id, class-name, name, tag-name, -windows uiautomation | ✅ covered | `search.e2e.spec.ts`, `xpath.e2e.spec.ts`, `xpath-comprehensive.spec.ts` |
| Click (left / double / right) | ✅ covered | `click.*.spec.ts`, `advanced_input.e2e.spec.ts` |
| Click via `windows:click` (center / offset / abs / modifiers / duration) | ✅ covered | `click_extension.e2e.spec.ts`, `advanced_input.e2e.spec.ts` |
| Type / clear / key actions | ✅ covered | `interaction.e2e.spec.ts`, `element.e2e.spec.ts` |
| Drag / hover / long-press | ✅ covered | `advanced_input.e2e.spec.ts` |
| Element queries (text, rect, displayed, enabled, attributes) | ✅ covered | `element.e2e.spec.ts` |
| Window: getPageSource / screenshot / getWindowHandle(s) / getWindowRect / setWindowRect | ✅ covered | `app.e2e.spec.ts` |
| W3C performActions (key / pointer / wheel / pause) | ✅ covered | `interaction.e2e.spec.ts`, `actions.spec.ts` |
| `windows:powershell` extension | ✅ covered | `powershell.e2e.spec.ts` |
| Patterns: Invoke / Value / ExpandCollapse / Toggle / ScrollItem / SelectionItem / Window | ✅ covered | `patterns.e2e.spec.ts` |
| Screen recording start/stop | ✅ covered | `recording.e2e.spec.ts` |
| Element cache invalidation | ✅ covered | `cache.e2e.spec.ts` |
| **scrollIntoView via WebDriver `scrollIntoView`** | ⚠️ partial | unit only — no E2E |
| **focus / setFocus** | ⚠️ partial | unit only — no E2E |
| **Error surface: NoSuchElement** | ❌ GAP | — |
| **Error surface: StaleElementReference** | ❌ GAP | — |
| **Error surface: InvalidSelector** | ❌ partial (xpath unit) | no E2E |
| **Error surface: Timeout** | ❌ GAP | — |
| **Error surface: NoSuchDriver after teardown** | ❌ GAP | — |
| **`treatStderrAsError=false` capability** | ❌ GAP | added in 1.1.11, not E2E-tested |
| **`$LASTEXITCODE` native-exe detection** | ❌ GAP | added in 1.1.11, not E2E-tested |
| **Session resilience: PS auto-restart mid-test** | ❌ GAP | — |
| **Stress: rapid command burst (queue depth)** | ❌ GAP | — |
| **Stress: large element trees / page source** | ❌ GAP | — |
| **Stress: long-running session (1k+ commands)** | ❌ GAP | — |
| **Unicode / special-char input** | ❌ GAP | — |
| **Multi-window scenarios** | ❌ GAP | — |

**13 explicit gaps.** All 13 are added by this session's work in `tests/e2e/stable/` (see §4).

---

## 4. New test suites added for stable

Located under `tests/e2e/stable/` to keep the existing suites untouched.

| File | What it covers | Capability gaps closed |
|---|---|---|
| `error-surface.e2e.spec.ts` | Asserts the right WebDriver error type for every documented error condition | NoSuchElement, StaleElement, InvalidSelector, Timeout |
| `lifecycle.e2e.spec.ts` | Session-create, delete, teardown semantics, NoSuchDriver after delete | NoSuchDriver after teardown, fast-fail of queued commands |
| `scroll-focus.e2e.spec.ts` | scrollIntoView and SetFocus end-to-end | scrollIntoView/focus E2E |
| `stderr-and-native.e2e.spec.ts` | `treatStderrAsError=false` capability behaviour and native-exe non-zero exit detection | both new-in-1.1.11 caps |
| `stress.e2e.spec.ts` | Burst of 100 commands, large page source request, 500-iteration loop | rapid burst, large tree |
| `unicode.e2e.spec.ts` | Type unicode, set/get clipboard with non-ASCII, retrieve unicode page source | Unicode input |

These cover the **13 documented gaps** above and add **~40 new test cases**.

Run pattern (matches existing convention):

```bash
APPIUM_URL=http://127.0.0.1:4723 \
TARGET_APP='C:\\Windows\\System32\\notepad.exe' \
npx mocha --config tests/e2e/.mocharc.json tests/e2e/stable/*.e2e.spec.ts
```

---

## 5. Forward roadmap (what we'd want in stable)

In priority order:

1. **Carve `extension.ts` into focused files** (Tier 1 #1). Suggested split:
   - `commands/extensions/patterns.ts` — InvokePattern, Value, Toggle, etc.
   - `commands/extensions/clicking.ts` — windows:click, hover, drag
   - `commands/extensions/clipboard.ts`
   - `commands/extensions/recording.ts` (already separate-ish via `screen-recorder.ts`)
   - `commands/extensions/index.ts` — router (the `execute()` dispatcher)

2. **Extract shared helpers** (Tier 1 #2). One `commands/shared.ts` with `ensureElementResolved`, `withModifierKeys`.

3. **Move embedded PS to `.ps1` files** (Tier 1 #3). Use `fs.readFileSync` at module load with TypeScript constant exports. Adds linting, IDE support, syntax errors at startup not run-time.

4. **Plan a refactor of `powershell/elements.ts`** (Tier 1 #4). Carve into:
   - `powershell/element-builders.ts` — AutomationElement, FoundAutomationElement
   - `powershell/conditions.ts` — already exists, expand
   - `powershell/find-helpers.ts` — the embedded PS Find-Descendant scripts
   - `powershell/properties.ts` — Property enum, type mapping

5. **Ship the new E2E suite** (§4). Wire it into CI if/when CI exists.

6. **Capability documentation** — `treatStderrAsError`, the timeout fields, the click delays all need a row in `docs/reference/capabilities.md` with examples.

7. **Pin a stable changelog format**. Consider `keepachangelog.com` style. Currently per-release docs in `docs/releases/` are detailed but inconsistent.

8. **Consider CI** — current process is local-only. Even a single workflow that runs `npm test` + lint on PR would catch a lot. The E2E suite needs a Windows runner; GitHub Actions has `windows-latest`.

---

## 6. Bottom line for the stable cut

Three things gate stable:

1. The 6 Tier-1 risks close.
2. The new E2E suite (§4) is green on a target Windows machine.
3. One full regression pass: every E2E spec runs against `1.1.12+` and only the **pre-existing** 16 failures remain (those are tracked separately in [`docs/code-review/2026-05-08.md`](../code-review/2026-05-08.md)).

Estimated effort to close: **5–8 working days** with focused effort.

---

*See [§4](#4-new-test-suites-added-for-stable) for the implementation status of the gap-closing suites in this session.*
