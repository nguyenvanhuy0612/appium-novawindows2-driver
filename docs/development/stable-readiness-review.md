# Stable Readiness Review

**Status:** Draft · 2026-05-12 · Third-pass synthesis
**Scope:** Whole-project review for the next stable cut. Builds on, supersedes, and **corrects** the two earlier reviews:

- [`design-review-stable.md`](design-review-stable.md) — release-planning angle (Tier-1/2/3 risk ranking, E2E coverage matrix, roadmap)
- [`deep-architecture-review.md`](deep-architecture-review.md) — per-module deep-read of `lib/xpath/`, `lib/powershell/`, `lib/winapi/`, `lib/commands/screen-recorder.ts`

This document covers what those two missed: the remaining `lib/` modules, the build/deploy/release infrastructure, the test layout, and project-level concerns. **Read those two first.**

---

## 1. Executive verdict

> **Status: not-yet-stable, but closer than the earlier reviews implied.**

The earlier reviews understated how much infrastructure already exists:

| Earlier claim | Reality |
|---|---|
| "No CI" | CI exists: `.github/workflows/lint-build.yml` (lint+build on PR, Ubuntu Node 24) and `release.yml` (build+lint on push to main/develop). What's missing is **Windows-side unit/e2e in CI**. |
| "`lib/commands/file.ts` is all stubs" | `file.ts` is fully implemented (~58 LOC, `pushFile`/`pullFile`/`pullFolder` via base64+PS). The previous claim was based on stale state. |
| "Release process is ad-hoc" | A 173-line **12-section release checklist** already exists at [`docs/development/release-process.md`](release-process.md) — explicitly cites the 1.1.9→1.1.10 hotfix lesson and includes §4 (imports vs deps audit), §6 (pack preview), §8 (clean-install smoke). |

So the real gap is not "we need to build all this from scratch" — it's: **fill the four specific cracks that have caused production hotfixes** (1.1.10, 1.1.11, 1.1.12) and update the docs that drifted during those fixes.

---

## 2. Corrections to prior reviews

Where this pass found the prior docs were wrong or oversimplified:

| Claim in prior review | Corrected |
|---|---|
| `commands/file.ts` is all stubs | **Implemented.** [`file.ts`](../../lib/commands/file.ts) does base64-bytes round-trip for push/pull/pullFolder via PS. Path traversal possible if path is user-controlled, but escaping is correct for PS strings. |
| Modifier-key state machine is "in `lib/driver.ts:41-77` only" | **In 3+ places**: `lib/driver.ts:71-77` (the `keyboardState` field), `lib/commands/actions.ts:164-242` (modifier press/release on key actions), `lib/commands/element.ts:231-269` (`setValue`'s `metaKeyStates` parallel state). They serve overlapping purposes and drift risk is real. |
| `commands/extension.ts` has "10+ concerns" | **33 exported async functions**, including ~17 thin pattern wrappers (3-4 LOC each) and ~6 substantive ones (`executeClick`, `executeHover`, `executeScroll`, `executeClickAndDrag`, `executeKeys`, `executePowerShellScript`). The carve-out is mostly mechanical for the wrappers, real refactoring for the input-action handlers. |
| The deploy script's "stop Appium" step is broken | **Confirmed and now patched in this session.** The earlier observation that `taskkill` triggers `$ErrorActionPreference = 'Stop'` was correct; the actual workaround applied was to bypass step 4 when Appium isn't running, not to fix the script. Should be a follow-up. |
| `lib/commands/app.ts:setWindow` has 20-iteration retry | **Confirmed** at [`app.ts:84-117`](../../lib/commands/app.ts). 20×500ms = 10s. Hardcoded with `// TODO: make a setting` comment four times in this file alone. |
| `lib/driver.ts:findElOrEls` has "list/listitem" tag overload | **Confirmed and duplicated.** Same logic in [`lib/xpath/core.ts:690-700`](../../lib/xpath/core.ts) and [`lib/driver.ts:147-156`](../../lib/driver.ts). Single source of truth would prevent drift. |

---

## 3. Complete module coverage table

After three passes, every file under `lib/` has been read at least once. Status:

| Module | LOC | Read depth | Risk | Refactor candidate? |
|---|---|---|---|---|
| `lib/driver.ts` | 333 | full | low | No — well-structured |
| `lib/util.ts` | 76 | full | low | No |
| `lib/constraints.ts` | 75 | full | low | No |
| `lib/enums.ts` | n/a | sampled | low | No (data file) |
| `lib/commands/index.ts` | 32 | full | low | No |
| `lib/commands/actions.ts` | 244 | full | low-medium | Modifier dedup |
| `lib/commands/app.ts` | 397 | full | medium | Retry constants → caps |
| `lib/commands/device.ts` | 44 | full | low | Clean up commented-out stubs |
| `lib/commands/element.ts` | 437 | full | medium | `setValue` (138 LOC) split |
| `lib/commands/extension.ts` | 887 | full | **high** | **Carve into 4-5 files** |
| `lib/commands/file.ts` | 59 | full | low-medium | Consider `pwsh` wrapper for path interpolation |
| `lib/commands/powershell.ts` | 568 | author (mine) | low (just rewrote in 1.1.12) | Drop in-queue restart per simplify pass |
| `lib/commands/screen-recorder.ts` | 295 | full | low-medium | Process-exit hook to kill ffmpeg |
| `lib/commands/system.ts` | n/a | sampled | low | No |
| `lib/powershell/core.ts` | 51 | full | low | No |
| `lib/powershell/common.ts` | 137 | full | low | Fix `PSCultureInfo` validation typo |
| `lib/powershell/conditions.ts` | 168 | full | low | No |
| `lib/powershell/elements.ts` | 938 | partial | **high** | **TODO acknowledged at line 6 — carve into 5 files** |
| `lib/powershell/converter.ts` | 397 | sampled | low | No |
| `lib/powershell/win32.ts` | 513 | partial (header only) | medium | Build `Win32Helper.dll` explicitly, not on first session |
| `lib/xpath/core.ts` | 904 | substantial | medium | `list`/`listitem` overload → single source |
| `lib/xpath/functions.ts` | 414 | full | low (fixed in this session) | — |
| `lib/winapi/user32.ts` | 909 | sampled | medium | ARM64 audit |
| `lib/winapi/types/*` | ~200 | scanned | low | No |

**Total: ~7,500 LOC of TS** (plus ~1,300 LOC of embedded PowerShell strings inside those files).

---

## 4. Cross-cutting findings

### 4.1 Modifier-key state duplication

Three implementations of "track which modifier keys are held":

- `lib/driver.ts:71-77` — `keyboardState` field on the driver instance
- `lib/commands/actions.ts:164-242` — uses that field, manages press/release for W3C `performActions`
- `lib/commands/element.ts:231-269` — `metaKeyStates` local var in `setValue`, parallel ad-hoc tracking with its own `toggleModifier` helper

They don't share an abstraction. If a `keyDown(Shift)` happens via `setValue` and then a separate `performActions` call expects shift state, the two views can disagree.

**Recommended fix**: extract a `KeyboardStateTracker` class to `lib/commands/keyboard-state.ts`. Both call sites use the same instance.

### 4.2 Hardcoded retry loops

Across `lib/commands/app.ts` alone, the pattern `20 attempts × 500ms` appears **4 times** ([`app.ts:86`](../../lib/commands/app.ts), [`app.ts:148`](../../lib/commands/app.ts), [`app.ts:171`](../../lib/commands/app.ts), [`app.ts:115`](../../lib/commands/app.ts)). Each has a `// TODO: make a setting` comment.

**Recommended fix**: introduce capabilities `windowRetryAttempts` (default 20) and `windowRetryIntervalMs` (default 500). Document. Remove the TODOs.

### 4.3 Inconsistent error-handling style

Patterns I found across `lib/commands/`:

| Pattern | Where | Effect |
|---|---|---|
| Try/catch + log.debug, re-throw | `commands/element.ts:click` (SetFocus fallback) | Good: error visible at debug, control flow continues |
| Try/catch + `// noop` | `commands/app.ts:288`, `commands/app.ts:53` (getScreenshot foreground) | Hides why something failed; future debugging harder |
| Throw UnknownError | `commands/element.ts:setValue` parameter validation | Correct for protocol errors |
| Throw NoSuchElement / NoSuchWindow | element/app | Correct W3C errors |
| Throw InvalidArgumentError | `commands/extension.ts` validators | Correct |
| Try without catch (intentional crash) | none seen | — |

Mostly correct. The few `// noop` catches in `app.ts` would be better as `log.debug(e.message)`.

### 4.4 Embedded PowerShell strings — total surface

Across the project (cumulative from prior reviews):

| File | LOC of PS / C# inside TS strings |
|---|---|
| `lib/powershell/elements.ts` | ~620 (30+ template literals) |
| `lib/powershell/win32.ts` | ~480 (PowerShell preamble + embedded C# source) |
| `lib/commands/functions.ts` (not in prior reviews) | ~150 (the `Find-Descendant` etc. helpers loaded into PS session) |
| `lib/commands/app.ts` | ~50 (Get-Process queries, $rootElement assignment) |
| `lib/commands/extension.ts` | ~60 (clipboard, tree-filter mutations) |
| `lib/commands/file.ts` | ~40 (push/pull/pullFolder) |
| `lib/commands/device.ts`, others | ~30 |
| **Total** | **~1,430 LOC of embedded PS/C#** |

**No tooling exists for any of it.** The `using namespace`-inside-`& {}` bug that caused 1.1.11 → 1.1.12 would have been caught by `Invoke-ScriptAnalyzer` (PSScriptAnalyzer). That's the single highest-leverage prevention measure for this whole class of bugs.

---

## 5. Build/deploy/release assessment

### Already in place

- **CI**: `.github/workflows/lint-build.yml` (Ubuntu, lint+build on PR), `.github/workflows/release.yml` (push to main, full build+prune)
- **Deploy**: `scripts/local/build_deploy_restart.ps1` — comprehensive 8-step deploy with `-SkipBuild`/`-SkipInstall`/`-NoRestart`/`-RestartOnly` flags
- **Release process**: `docs/development/release-process.md` — 12-section pre-publish checklist with lessons-baked-in table
- **Build target**: `tsc -b`, output to `build/`, `files: ["build"]` in package.json (clean)
- **Package shape**: no `lib/` ships, no test/docs ship, 156 files / ~187 KB tarball (validated this session)

### Gaps (vs. what stable needs)

| Gap | Severity | Notes |
|---|---|---|
| **Unit tests don't run in CI** | High | `lint-build.yml` only does lint+build. A failing unit test would still merge. |
| **E2E tests don't run in CI** | High | E2E needs Windows; CI uses ubuntu-latest. Would need `runs-on: windows-latest` and an Appium service. |
| **No PSScriptAnalyzer** | High | ~1,400 LOC of embedded PowerShell has zero syntax/style checking |
| **No `engines.node` field** in package.json | Medium | Should declare Node ≥ 18 (or whatever Appium 3 requires) — install warnings surface incompatibility |
| **Deploy script's stop-Appium step is brittle** | Medium | `$ErrorActionPreference=Stop` + `taskkill` "process not found" stderr halts the script. Patch: `2>&1 \| Out-Null; $global:LASTEXITCODE = 0` after each taskkill. |
| **`Win32Helper.dll` compiled on first session** | Medium | Implicit build, no version control. Adding a `prepublishOnly` step to compile it would mean every install gets the same DLL, faster first session. |
| **No CHANGELOG.md** | Low | per-release docs exist in `docs/releases/`. CHANGELOG.md (keepachangelog style) would help npm consumers. |

---

## 6. Test infrastructure assessment

### Layout

| Dir | Files | Purpose | Run by |
|---|---|---|---|
| `tests/unit/` | 20 specs | TypeScript unit tests (PS expression generation, XPath parsing, etc.) | `npm test` (mocha + ts-node) |
| `tests/e2e/` | 7 specs + new `stable/` subdir | E2E mocha specs, run against a live Appium driver | `npm run test:e2e:*` (per spec) |
| `tests/all_e2e/` | 10 specs + `tests.md` | Alternate E2E suite | not in package.json scripts |
| `tests/dev_xpath/`, `dev_24Mar/`, `dev_att/`, `dev_controlType/` | scratch | Feature-branch test workspaces | not run automatically |
| `tests/debug/` | ~15 Python scripts | Manual debugging | not run automatically |
| `tests/analyze/` | results + analyze-session.mjs | Post-test analysis | manual |
| `tests/results/` | timestamped output | Run artifacts | written by E2E specs |
| `tests/E2E_TEST_PLAN.md` | doc | Test planning | — |

### Findings

**Strengths:**
- 906 unit tests, 0 failing (as of 6a364f3)
- The new `tests/e2e/stable/` suite from this session is 33 tests covering the 13 documented coverage gaps
- `tests/all_e2e/tests.md` exists and tracks which features are covered

**Gaps:**
- **`tests/all_e2e/` vs `tests/e2e/` purpose is unclear.** Both have e2e specs targeting Notepad. Why two? The package.json scripts only invoke `tests/e2e/*`. `tests/all_e2e/` looks like a more comprehensive suite that's not wired in.
- **Pre-existing failures aren't tracked.** The 16 failures from the 1.1.10 smoke run (triaged in [deep-architecture-review.md §5](deep-architecture-review.md#5-triage-of-the-16-pre-existing-e2e-failures)) — 3 real driver gaps (1 now fixed), 13 test-code drift. Refreshing the existing xpath spec would close 13 of them mechanically.
- **No coverage report** — `tests/unit/` runs but reports only pass/fail. Coverage of `lib/` is unknown; some branches likely never exercised.
- **`tests/debug/` and `tests/analyze/` and `dev_*/` directories ship with the repo** but are scratch — they should either be gitignored or moved to a top-level `scratch/` directory so contributors don't mistake them for real test surfaces.

---

## 7. Documentation completeness

### What exists

- **architecture/**: overview, components, powershell-session, api-inventory (4 docs, 1,290 LOC total)
- **reference/**: capabilities, commands, error-codes, extensions, finding-elements (5 docs, 2,170 LOC total)
- **development/**: build, deploy, release-process, testing — plus my three review docs from this session
- **introduction/**: overview, comparison, enterprise-focus
- **releases/**: per-version notes
- **code-review/**: per-date static-analysis trackers

### Gaps

| Gap | Severity | Fix |
|---|---|---|
| `treatStderrAsError` capability not in `docs/reference/capabilities.md` | High | Add row with default (true) + example |
| `$LASTEXITCODE` / native-exit detection only mentioned 2x in `extensions.md` | Medium | Add a paragraph under `windows: powershell` explaining the new error path |
| XPath property allowlist (21 properties) not in `docs/reference/finding-elements.md` | High | The 21 allowed `@PropName` values from [xpath/core.ts:85-107](../../lib/xpath/core.ts), with a note that other properties work but fall back to slower JS-side evaluation |
| Pattern-extension argument shape (`element[W3C_ELEMENT_KEY]` vs `{elementId}`) not in `docs/reference/extensions.md` | High | I burned ~3 test rounds discovering this. **Every** test author after me will too. Document it once. |
| `powershell` vs `windows: powershell` routing | High | The bare `powershell` works; `windows: powershell` does NOT route to `executePowerShellScript`. Document the routing rule. |
| Selenium CSS-selector shortcuts (`#id`, `.class`, `*[name="x"]`) not in `docs/reference/finding-elements.md` | Low | [`driver.ts:304-331`](../../lib/driver.ts) implements them; mention as legacy convenience |
| Hardcoded retry caps don't exist as documented caps | Low | Add `windowRetryAttempts` etc. after implementing |

---

## 8. CI/CD status

Current:

```yaml
# .github/workflows/lint-build.yml — runs on PR
- npm install --no-package-lock
- npm run lint
- npm run build

# .github/workflows/release.yml — runs on push to main/develop
- npm install --no-package-lock
- npm run build
- npm run lint
- npm prune --omit=dev --omit=peer
(presumably npm publish — file was truncated)
```

Missing for stable:

1. **`npm test` step in lint-build.yml** — runs the 906 unit tests on every PR. Currently a regression could merge unnoticed.
2. **A separate Windows job in lint-build.yml** with `runs-on: windows-latest` that:
   - Installs Appium
   - Registers the driver
   - Starts Appium server in background
   - Runs `tests/e2e/stable/*.e2e.spec.ts` against localhost (proven to work in this session)
   - Tags the job optional or required based on stability
3. **`scripts/lint-ps.ps1`** that runs `Invoke-ScriptAnalyzer` against every `.ps1` file under `scripts/` AND scans embedded PS strings in `lib/**/*.ts` (extracting them via regex, writing to temp files, analyzing). Wire into the PR job.

These three additions are the single biggest reliability lever before stable.

---

## 9. Consolidated risk register (all three reviews)

Pulling from the two earlier docs + this pass. **Severity scale**: 🔴 blocks stable / 🟠 must address before stable / 🟡 should address before stable / 🟢 nice-to-have.

| # | Risk | Severity | Where it lives | Effort |
|---|---|---|---|---|
| 1 | `commands/extension.ts` is 33 functions × 887 LOC | 🟠 | [`extension.ts`](../../lib/commands/extension.ts) | 1-2 days carve-out |
| 2 | `powershell/elements.ts` author-flagged TODO debt | 🟠 | [`elements.ts:6`](../../lib/powershell/elements.ts) | 1 day mechanical |
| 3 | Embedded PS has no linting (root cause of 1.1.11 → 1.1.12) | 🔴 | Cross-cutting | 0.5 day to wire PSScriptAnalyzer |
| 4 | Unit tests don't run in CI | 🔴 | `.github/workflows/lint-build.yml` | 30 min |
| 5 | E2E tests don't run in CI | 🟠 | needs Windows runner | 1-2 days |
| 6 | Modifier-key state duplicated in 3 places | 🟡 | actions/element/driver | 0.5 day extract |
| 7 | Hardcoded retry constants × 4 in app.ts | 🟡 | [`app.ts`](../../lib/commands/app.ts) | 0.5 day caps + tests |
| 8 | Hidden contracts (W3C_ELEMENT_KEY, 21-prop allowlist, `powershell` routing) not in user docs | 🟠 | `docs/reference/*` | 0.5 day |
| 9 | `treatStderrAsError` cap (1.1.11) not in user docs | 🟠 | `docs/reference/capabilities.md` | 1 hour |
| 10 | 16 pre-existing E2E failures (13 test-drift after WDIO v9 + Win11 Notepad UI) | 🟡 | `tests/e2e/xpath.e2e.spec.ts` | 0.5 day |
| 11 | `tests/all_e2e/` vs `tests/e2e/` purpose unclear | 🟡 | Doc + or merge | 1 hour |
| 12 | Win32Helper.dll built implicitly on first session | 🟡 | `lib/powershell/win32.ts` | 2 hours add build step |
| 13 | ARM64 koffi struct layouts untested | 🟡 | `lib/winapi/user32.ts` | Needs ARM hardware |
| 14 | No `engines.node` in package.json | 🟢 | `package.json` | 5 min |
| 15 | `tests/debug/`, `tests/dev_*/`, `tests/analyze/` ship with repo as scratch | 🟢 | gitignore or move | 30 min |
| 16 | `commands/file.ts` paths interpolated into PS without `pwsh` wrapper | 🟢 | Low risk; consider hardening | 2 hours |
| 17 | DPI awareness set but never restored | 🟢 | `lib/winapi/user32.ts` | 1 hour |
| 18 | XPath `list`/`listitem` tag overload duplicated in driver + xpath/core | 🟢 | Single source of truth | 30 min |
| 19 | XPath `floor/ceiling/round` rejected non-number args | ✅ **fixed in this session** (6a364f3) | — | done |

---

## 10. Stable-cut go/no-go checklist

In the spirit of [`release-process.md`](release-process.md), this is what specifically applies to the **stable** cut, not every release. Tick before publishing the first stable.

### Must-do (🔴/🟠 from §9)

- [ ] **Wire `npm test` into `lint-build.yml`** (~30 min) — prevents unit-test regression
- [ ] **Add PSScriptAnalyzer step to CI** (~0.5 day) — prevents the class of bug that caused 1.1.11 → 1.1.12
- [ ] **Carve up `commands/extension.ts`** (~1-2 days) — 33 functions into 4-5 focused files; biggest leverage refactor
- [ ] **Carve up `powershell/elements.ts`** (~1 day) — author-acknowledged debt
- [ ] **Document the hidden contracts** in `docs/reference/`:
  - [ ] Pattern argument shape (`element[W3C_ELEMENT_KEY]`, pass Element object) in `extensions.md`
  - [ ] `powershell` vs `windows: powershell` routing in `extensions.md`
  - [ ] The 21-property XPath allowlist in `finding-elements.md`
  - [ ] `treatStderrAsError`, `$LASTEXITCODE` detection paths in `capabilities.md` + `extensions.md`
- [ ] **Add Windows e2e job to CI** (~1-2 days) — runs `tests/e2e/stable/*.e2e.spec.ts` on every PR

### Should-do (🟡)

- [ ] Extract `KeyboardStateTracker` to dedupe modifier state across 3 files
- [ ] Add `windowRetryAttempts` / `windowRetryIntervalMs` capabilities, replace hardcoded `20 × 500ms`
- [ ] Refresh `tests/e2e/xpath.e2e.spec.ts` for WDIO v9 + Win11 Notepad (closes 13 of 16 known failures)
- [ ] Clarify or merge `tests/all_e2e/` and `tests/e2e/`
- [ ] Build `Win32Helper.dll` explicitly via a npm script, ship in build/

### Nice-to-have (🟢)

- [ ] Add `engines.node: ">=18"` to package.json
- [ ] gitignore or move `tests/debug/`, `tests/dev_*/`, `tests/analyze/` to a `scratch/` dir
- [ ] Restore DPI awareness on session end
- [ ] Single-source the XPath `list`/`listitem` overload
- [ ] Harden `commands/file.ts` path interpolation via `pwsh` wrapper

### Don't-do for first stable

- [ ] WebView2 / chromedriver integration (deferred per [docs/project-overview.md](../project-overview.md))
- [ ] ARM64 unless someone has the hardware
- [ ] Performance optimisations on the base64 PS wrap (cosmetic concern only)

---

## 11. Honest meta-observation

This is now the third review document for the same release. Each found things the previous missed. That's not a bug in the reviews — it's a real signal that **the project's existing docs aren't keeping pace with the code**. Specifically:

- `release-process.md` is excellent but exists in isolation — there's no link from any release notes back to it as the actual checklist used.
- `docs/code-review/2026-05-08.md` exists; nothing in newer commits references it.
- The new capabilities `treatStderrAsError` and the `$LASTEXITCODE` behaviour landed in 1.1.11 without updates to `docs/reference/capabilities.md` or `docs/reference/extensions.md`.
- This review and the previous two have not been linked from `docs/index.md`.

**The simplest single fix that would unlock the rest**: a `make docs-check` (or `npm run docs:check`) that grep-scans the codebase for unreferenced capabilities, undocumented extension commands, and stale CHANGELOG entries — runs in CI. ~half a day to write, prevents all future reviews from missing the same things.

---

## 12. Bottom line for the stable cut

The architecture is solid (confirmed across three deep reads). The protocol layer is rigorous (post-1.1.12). The tests are extensive (906 unit + 33 new stable e2e + 17 existing e2e specs). The docs are comprehensive, just not kept current.

**The remaining work to ship a stable cut is mostly mechanical** — wire what exists into CI, carve up the two god-files, refresh the docs to match the implementation, and run the §10 checklist before publishing.

Estimated total effort to close 🔴/🟠 items: **5-8 focused working days** (consistent with the earlier `design-review-stable.md` §6 estimate, now backed by three review passes).

If you publish a stable version with everything in §10 ✅, you can credibly call it `2.0.0` (the api surface stays the same; the carve-up is internal; the version bump signals "we've made this robust"). If you don't, keep it in the 1.1.x patch range and don't tag stable yet.
