# Phase 2: Path to Stable v2.0.0

**Status:** Plan · 2026-05-12 · Successor to [`stable-readiness-review.md`](stable-readiness-review.md)
**Goal:** Close the 5 🔴/🟠 items from the §10 readiness checklist and tag `v2.0.0` as the first long-term-stable release.
**Estimated effort:** 5–8 focused working days.
**Format:** Each task has a concrete goal, the specific files affected, the verification step, and the time budget. Designed to be picked up cold.

This document is **not** a wish list — it's a plan. Items in scope here MUST land; items in §6 are deferred to later 2.x.x releases.

---

## 1. What "stable v2.0.0" means

> Users can `npm install appium-novawindows2-driver@latest` knowing:
> 1. Every public command has at least one E2E test running in CI on every PR
> 2. The PowerShell layer is linted (no more "looked right in TS but breaks in PS" hotfixes like 1.1.11)
> 3. The two god-files (`extension.ts`, `elements.ts`) have been carved so future bug-fix PRs only touch related code
> 4. Every documented capability and extension command in `docs/reference/` matches what the driver actually does
> 5. The driver's hidden contracts (W3C_ELEMENT_KEY, `powershell` vs `windows: powershell`, the 21-property XPath allowlist) are surfaced in user-facing docs

The version bump to `2.0.0` signals "we've made this robust" — the API surface stays the same, the carve-up is internal.

## 2. Starting state (end of Phase 1)

| | |
|---|---|
| npm | `1.1.13` published, `1.1.11` deprecated |
| Git | `main` at `80bdb12` (after the v1.1.13 release notes commit), all tags pushed |
| Tests | 906 unit + 82 stable E2E, all green |
| CI | `.github/workflows/lint-build.yml` runs lint+build on Ubuntu; **does NOT run `npm test`**, **does NOT run E2E** |
| Open backlog | [`stable-readiness-review.md` §10](stable-readiness-review.md#10-stable-cut-go-no-go-checklist) — 5 🔴/🟠 items still open |

## 3. Day-by-day plan

### Day 1 — CI hardening (highest leverage, lowest risk)

**Task 1.1 — Wire `npm test` into the PR workflow** (~30 min)

- Edit `.github/workflows/lint-build.yml`: add a step `npm test` after the existing lint+build steps.
- **Verify**: open a PR with a deliberately-failing unit test, confirm CI fails. Revert.

**Task 1.2 — Add PSScriptAnalyzer to the PR workflow** (~3–4 hours)

- New file `scripts/lint-ps.ps1` that:
  - Installs `PSScriptAnalyzer` if not already on `$env:PSModulePath`
  - Lints every `.ps1` under `scripts/`
  - Extracts embedded PS strings from `lib/**/*.ts` via regex (`/* ps1 */`, `pwsh\``, `pwsh$\``, `@'…'@`), writes each to a temp `.ps1`, runs the analyzer, then unlinks
  - Exits non-zero if any rule of severity `Warning` or `Error` fires; emits `::error::` annotations for GitHub
- In `.github/workflows/lint-build.yml`: add a **Windows job** (`runs-on: windows-latest`) that runs `pwsh scripts/lint-ps.ps1`. Initial run will surface findings — fix or `[Diagnostic(Suppress…)]` them.
- **Verify**: deliberately introduce `& { using namespace System.Windows.Automation }` somewhere, confirm CI catches it. Revert.
- **Why this is the single highest-leverage item**: would have caught the 1.1.11 → 1.1.12 hotfix bug before publish.

**Task 1.3 — Add `engines.node` to `package.json`** (~5 min)

- `"engines": { "node": ">=18" }` (or whatever Appium 3's minimum is).
- **Verify**: `npm install` on Node 16 emits a warning; on Node 18+ silent.

**End of Day 1**: PR can no longer merge with failing unit tests or PowerShell lint errors. **Tag `v1.2.0-rc.1` if you want a checkpoint here.**

---

### Day 2 — Refresh existing E2E + document hidden contracts

**Task 2.1 — Refresh `tests/e2e/xpath.e2e.spec.ts` for WDIO v9 + Win11 Notepad** (~0.5 day)

13 of the 16 known pre-existing failures are test-code drift. Per [`deep-architecture-review.md` §5](deep-architecture-review.md#5-triage-of-the-16-pre-existing-e2e-failures):

- 3 WDIO v9 API renames: `getElementAttribute(elementId, name)` → `getAttribute(name)` on Element; `findElementsFromElement` shape; `getElementRect` removed
- 7 Win11 Notepad UI drift: the test fetches the root's `@Name` and queries elements with that name — Win11 Notepad's Name format differs
- 2 error-class name expectations: `error.name === 'InvalidSelectorError'` no longer matches WDIO's `WebDriverError`; check `error.error === 'invalid selector'` instead
- 1 findElement-no-match: WDIO v9 returns a lazy Element instead of throwing — use `$(…).isExisting() === false`

**Verify**: All 16 failures close; the suite reports `0 failing`. Update [`docs/development/testing.md`](testing.md) inventory.

**Task 2.2 — Document the hidden contracts in `docs/reference/`** (~3–4 hours)

Five concrete additions, in priority order:

| Add | To | Source |
|---|---|---|
| `treatStderrAsError` capability row (default `true`, what false enables) | [`docs/reference/capabilities.md`](../reference/capabilities.md) | `lib/constraints.ts:62-72` |
| `$LASTEXITCODE` / native-exit detection paragraph under `windows: powershell` | [`docs/reference/extensions.md`](../reference/extensions.md) | `lib/commands/powershell.ts` framing protocol |
| Pattern-extension argument shape: pass the **Element object**, not `{ elementId }` | [`docs/reference/extensions.md`](../reference/extensions.md) — top of UIA Patterns section | `lib/commands/extension.ts:344-351` (`resolvePatternElement`) |
| 21-property XPath allowlist — which `@PropName` values get pushed down to PS vs. fall back to JS eval | [`docs/reference/finding-elements.md`](../reference/finding-elements.md) | `lib/xpath/core.ts:85-107` |
| `powershell` (bare) vs `windows: powershell` routing — only the bare form runs PS; the prefixed form throws "Unknown command" | [`docs/reference/extensions.md`](../reference/extensions.md) — PowerShell escape-hatch section | `lib/commands/extension.ts:198-214` |

**Verify** for each: paste a runnable code snippet, confirm it actually works against a live driver. (These are the gotchas that burned us during E2E test writing in Phase 1 — they MUST be discoverable to users.)

**End of Day 2**: all 16 known E2E failures closed; user-facing docs match the implementation.

---

### Day 3–4 — Carve `lib/commands/extension.ts` (the god-file)

**Task 3 — Mechanical carve-out** (~1–2 days)

Current state: 887 LOC, 33 exported functions, 10+ concerns mixed.

**Target structure:**

```
lib/commands/extensions/
├── index.ts            # the execute() router; re-exports + EXTENSION_COMMANDS table
├── patterns.ts         # patternInvoke, patternExpand, patternCollapse,
│                       # patternToggle, patternScrollIntoView, patternIsMultiple,
│                       # patternGetSelectedItem, patternGetAllSelectedItems,
│                       # patternAddToSelection, patternRemoveFromSelection,
│                       # patternSelect, patternSetValue, patternGetValue,
│                       # patternMaximize, patternMinimize, patternRestore,
│                       # patternClose, focusElement
│                       # + resolvePatternElement, runPatternCommand helpers
├── clicking.ts         # executeClick, executeHover, executeScroll, executeClickAndDrag
├── keyboard.ts         # executeKeys, MODIFIER_KEY_MAP, withModifierKeys
├── clipboard.ts        # getClipboardBase64, setClipboardFromBase64,
│                       # SET_PLAINTEXT_CLIPBOARD_FROM_BASE64, GET_PLAINTEXT_CLIPBOARD_BASE64,
│                       # SET_IMAGE_CLIPBOARD_FROM_BASE64, GET_IMAGE_CLIPBOARD_BASE64
├── system.ts           # activateProcess, getAttributes, typeDelay,
│                       # pushCacheRequest, TREE_FILTER_COMMAND
└── powershell-script.ts  # executePowerShellScript (the bare 'powershell' route)
```

Workflow:

1. Create the new directory + empty files
2. Move one concern at a time, run `npm test` + `npm run test:e2e:stable` after each move
3. The router `index.ts` re-exports everything so `lib/commands/index.ts` still gets the same flat namespace
4. After all moves: `git rm lib/commands/extension.ts`; replace with a thin re-export shim OR remove entirely

**Verify**: 906 + 82 tests still green; `lib/commands/extension.ts` is either deleted or a 1-line re-export.

**Risk**: low. The 82-test stable suite covers every dispatch path through `execute()`. Test isolation is sufficient.

---

### Day 5 — Carve `lib/powershell/elements.ts` (the TODO file)

**Task 4 — Mechanical carve-out** (~1 day)

Current state: 938 LOC, author-flagged TODO at line 6 ("too complicated and not easy to maintain").

**Target structure** (per [`deep-architecture-review.md` §2.4](deep-architecture-review.md#libpowershellelementsts-938-loc--the-todo-file)):

```
lib/powershell/element/
├── automation-element.ts  # AutomationElement, AutomationElementGroup, FoundAutomationElement classes (160 LOC)
├── tree-walkers.ts        # The 14 embedded PS scripts:
│                          # FIND_ALL_ANCESTOR, FIND_FIRST_ANCESTOR,
│                          # FIND_ALL_ANCESTOR_OR_SELF, FIND_FIRST_ANCESTOR_OR_SELF,
│                          # FIND_PARENT, FIND_FOLLOWING, FIND_ALL_FOLLOWING,
│                          # FIND_FOLLOWING_SIBLING, FIND_ALL_FOLLOWING_SIBLING,
│                          # FIND_PRECEDING, FIND_ALL_PRECEDING,
│                          # FIND_PRECEDING_SIBLING, FIND_ALL_PRECEDING_SIBLING,
│                          # FIND_CHILDREN_OR_SELF, FIND_ALL_CHILDREN_OR_SELF
│                          # + FIND_DESCENDANTS, FIND_ALL_DESCENDANTS variants
├── element-table.ts       # SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID, ELEMENT_TABLE_GET
├── properties.ts          # GET_ELEMENT_PROPERTY, GET_ELEMENT_PATTERN_PROPERTY,
│                          # GET_ELEMENT_LEGACY_PROPERTY, GET_ALL_ELEMENT_PROPERTIES,
│                          # GET_ELEMENT_RUNTIME_ID, GET_ELEMENT_TAG_NAME,
│                          # GET_ELEMENT_RECT, GET_ELEMENT_SCREENSHOT,
│                          # GET_ELEMENT_TEXT, GET_ELEMENT_SOURCE
├── patterns-ps.ts         # All the INVOKE_/EXPAND_/COLLAPSE_/TOGGLE_/SCROLL_/SET_VALUE_/etc. constants
│                          # (these are PS expression templates, not handlers)
└── index.ts               # re-exports everything
```

Same workflow as Day 3–4 — incremental moves, test after each.

**Verify**: 906 + 82 tests still green; the TODO comment at the top of `elements.ts` is gone (file is replaced by the directory).

**Risk**: low for the same reason — full test coverage.

---

### Day 6 — Windows E2E in CI

**Task 5 — Add a `windows-latest` job that runs the stable E2E suite** (~1–2 days)

This is the most involved task because it requires getting Appium to start in CI.

**Steps:**

1. New job in `.github/workflows/lint-build.yml`:
   ```yaml
   e2e-windows:
     runs-on: windows-latest
     needs: build
     steps:
       - uses: actions/checkout@v5
       - uses: actions/setup-node@v6
         with:
           node-version: 24.x
       - run: npm ci
       - run: npm run build
       - run: npm install -g appium
       - run: appium driver install --source=local "${{ github.workspace }}"
       - run: appium --relaxed-security --log-level info:debug &
       - run: |
           # wait for /status
           for i in 0..30 { try { iwr http://localhost:4723/status -t 2 | out-null; break } catch { Start-Sleep 1 } }
       - run: npx mocha --no-config -r ts-node/register --timeout 300000 tests/e2e/stable/*.e2e.spec.ts
         env:
           APPIUM_URL: http://localhost:4723
   ```

2. Expect the FIRST run to surface CI-specific failures:
   - `app: 'C:\Windows\System32\notepad.exe'` may not exist on the runner image — Win11 Notepad lives elsewhere or is a Store app. **Fallback**: use `Root` for everything except `lifecycle.e2e.spec.ts` and `scroll-focus.e2e.spec.ts`, OR detect and skip those tests gracefully in CI via an env-var guard.
   - Screen recording may fail (no display surface). The component-coverage suite already accepts empty output for this case; verify the skip-on-missing-deps path works.

3. Once green: mark the job **required** for PR merges.

**Verify**: A deliberate driver-side regression (e.g., revert the 1.1.13 XPath fix on a PR branch) is caught in CI before merge.

**Risk**: medium. CI Windows runner specifics may need iteration. Budget a full day for initial setup + 0.5 day for triage.

---

### Day 7 — 2.0.0 release

**Task 6 — Execute the release-process.md checklist for 2.0.0** (~0.5 day)

Run through every section of [`docs/development/release-process.md`](release-process.md), specifically:

- §1: Bump `package.json` from `1.1.13` → `2.0.0`. **No API breaks, but the major bump signals the carve-up internal refactor + the production-grade testing infrastructure.**
- §2: Pair-review the carve-outs; verify no orphan imports
- §3: 906+ unit tests + 82 E2E tests all passing
- §4: imports vs deps audit (especially after the carve)
- §6: `npm pack --dry-run` — confirm `build/` shape unchanged
- §7: `CHANGELOG.md` entry; longform `docs/releases/2.0.0.md` write-up
- §8: Clean-install smoke on a separate VM (i.e., not the dev machine)
- §10: `npm publish`
- §11: Tag, GitHub Release, deprecate any version older than 1.1.10 if you want to nudge users forward

**Verify**:

```sh
npm view appium-novawindows2-driver version              # → 2.0.0
npm view appium-novawindows2-driver@2.0.0 deprecated     # → undefined
gh release view v2.0.0                                   # → exists, "Latest"
```

Plus a fresh smoke on a new VM.

---

## 4. Optional items (do if time permits)

These would improve the stable cut but are not blockers:

- **`scripts/docs-check.ps1`** — grep-scans `lib/` for capabilities + extension commands NOT mentioned in `docs/reference/`. Per the readiness review's "simplest single fix" observation. ~0.5 day. Run in CI.
- **`KeyboardStateTracker` class** — dedupe the modifier-key state machine across `lib/driver.ts`, `lib/commands/actions.ts`, `lib/commands/element.ts`. ~0.5 day.
- **`windowRetryAttempts` / `windowRetryIntervalMs` capabilities** — replace the four hardcoded `20 × 500ms` retry loops in `lib/commands/app.ts`. ~0.5 day. Doc as caps.
- **Build `Win32Helper.dll` explicitly** in a `prebuild` npm script so it ships in `build/` rather than being implicitly compiled on first session. ~2 hours.
- **gitignore or move** `tests/debug/`, `tests/dev_*/`, `tests/analyze/` so they don't ship as scratch artifacts. ~30 min.

---

## 5. Out of scope (explicitly deferred to 2.x.x)

- **WebView2 / chromedriver integration** (upstream's 1.4.0 path). Documented as deliberately-skipped in `docs/project-overview.md`. Re-evaluate only if a real use case appears.
- **ARM64 support audit** — needs ARM hardware; nothing in this plan tries to test it. The koffi struct layouts may already work on ARM64 by accident; verify when hardware is available.
- **Full coverage breadth** — Phase 1's 82-test stable suite is "one test per component", not exhaustive. Adding 100+ deep-coverage tests is a 2.x.x effort, not a 2.0.0 blocker.
- **WebDriver BiDi support** — irrelevant for native Windows UIA driving.

---

## 6. Risk register specific to Phase 2

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | Carve-up introduces import-cycle bugs caught only at runtime | Medium | Run `npm test` + stable E2E after EVERY move during the carve, not just at the end |
| 2 | PSScriptAnalyzer surfaces 100+ existing warnings, blocking the PR | Medium | First-pass: run locally before wiring to CI; suppress acknowledged-warnings inline; only fail CI on Error severity initially |
| 3 | Windows CI runner can't launch Notepad in headless mode | High | Use `app: 'Root'` for all stable suites in CI; keep Notepad-anchored tests as a manual smoke step on a real VM |
| 4 | Deleting `tests/all_e2e/` (if redundant with `tests/e2e/`) loses a regression guard | Low | Audit `tests/all_e2e/` for tests NOT in `tests/e2e/`; merge the diff before deleting; don't delete in same PR as the carve |
| 5 | 2.0.0 marketing implies bigger changes than exist | Low | Be explicit in release notes: "Stable infrastructure, same API. No breaking changes from 1.1.13." |
| 6 | A genuine breaking change emerges during the carve (e.g., import cleanup forces a public-shape change) | Low | If it happens: stop the carve, ship the breaking change as 2.0.0-alpha.1, get user feedback, then proceed |

---

## 7. Stop-loss criteria

When to call Phase 2 done **without** completing all 7 days:

- All 5 🔴/🟠 items from `stable-readiness-review.md` §10 are closed → ship 2.0.0
- Unit tests + stable E2E suite + PSScriptAnalyzer are gating PRs → ship 2.0.0 even if optional items in §4 aren't done
- Carve of `extension.ts` is done but `elements.ts` is half-finished → consider shipping 2.0.0 with only `extension.ts` carved, finish `elements.ts` in 2.1.0
- Day 6's Windows CI is fragile but functioning → ship 2.0.0; harden CI in 2.0.1

When to **abort** Phase 2:

- An item surfaces a real driver bug that requires a 1.1.14 patch first → patch, then resume
- Carve introduces hard-to-fix import cycles or test regressions that can't be debugged in a half-day → revert that single carve, ship 2.0.0 without it, re-attempt in 2.1.0
- Windows CI runner support for native UI tests turns out to be impossible in GitHub Actions → fall back to "running the stable suite on a self-hosted Windows runner" or "documented manual checklist before each release"

---

## 8. Quick-start for the next session

```sh
# Confirm starting state
git status                          # → clean
git log --oneline -3                # → 80bdb12 docs(releases)...

# Day 1 task 1.1 (5 min):
$EDITOR .github/workflows/lint-build.yml   # add npm test step

# Day 1 task 1.2 (3-4 hr):
$EDITOR scripts/lint-ps.ps1         # author the analyzer wrapper
$EDITOR .github/workflows/lint-build.yml   # add windows-latest job

# Day 1 task 1.3 (5 min):
$EDITOR package.json                # add "engines": { "node": ">=18" }

# Commit + open PR for end-of-day-1 checkpoint
git commit -am "ci: gate PRs on npm test, PSScriptAnalyzer, Node>=18"
git push origin <branch>
gh pr create --fill
```

Pick one task per session if context-switching is expensive. The dependency graph allows tasks within a day to be reordered freely, but Day 3–4 (carve `extension.ts`) should land before Day 5 (carve `elements.ts`) because the latter imports from the former.

---

## 9. Bottom line

The 1.1.13 release on npm is **production-suitable today**. Phase 2 doesn't fix bugs — it fixes the **release-process fragility** that caused 1.1.10 → 1.1.11 → 1.1.12 → 1.1.13. The four hotfixes in two weeks are evidence that the test coverage, CI gating, and documentation aren't catching what they should.

After Phase 2, the same kind of mistake should fail CI before it ever reaches `npm publish`. That's what "stable" means here — not a feature freeze, but a quality-gate guarantee.
