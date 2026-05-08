# Release Process

Pre-publish checklist for shipping a new version of `appium-novawindows2-driver` to npm. Designed to be **clonable per release** — copy this file's checklist into a release issue, tick items as you go.

The `1.1.9 → 1.1.10` hotfix was caused by skipping items in §5 and §8 below — **those steps would have caught the missing `asyncbox`/`teen_process` declarations before publish**.

---

## 1. Decide the version & scope

- [ ] Confirm the **semver bump** matches the actual change set
  - **patch** (`1.1.x`) — bug fixes only, no API additions, no behaviour changes a caller would notice
  - **minor** (`1.x.0`) — new public commands/capabilities/extension points; backward-compatible behaviour additions
  - **major** (`x.0.0`) — removed/renamed APIs, changed defaults, dropped Node/Appium peer-dep range
- [ ] Decide if this release should be tagged `latest` (default) or `next` / `beta` (for risky changes)
- [ ] Update `package.json` `version` field
- [ ] Cross-check: does the version match what's stated in `CHANGELOG.md` and `docs/releases/<ver>.md`?

## 2. Code & architecture review

Match the user's stated review intent + the things prior reviews missed.

- [ ] **Logic review**: trace every changed function for off-by-one, swapped operators, missing null checks, swallowed errors. Ideally use a fresh agent or pair-review — author bias misses these.
- [ ] **Architecture review**: do new modules/handlers live in the right layer (`lib/commands/` vs `lib/powershell/` vs `lib/winapi/`)? Does the change introduce a new cross-layer dependency that should be a helper instead?
- [ ] **API surface review**: are any `export` statements broader than they should be? Anything in `lib/commands/index.ts` that was meant to stay internal?
- [ ] **Optional-stack hygiene** (this project specifically): everything related to screen recording (`asyncbox`, `teen_process`, `ffmpeg-static`) must be **lazy-required and `optionalDependencies`** so Win-ARM64 installs without those packages still load the driver. Same for any future native-binary-bearing dep.
- [ ] **Backward compatibility audit**: every command in [`docs/reference/commands.md`](../reference/commands.md) and [`docs/reference/extensions.md`](../reference/extensions.md) must still respond with the documented shape. Renamed args, removed fields, or stricter validation count as breaking.
- [ ] Edit/refactor anything flagged.

## 3. Tests

- [ ] `npm test` passes locally — **0 failing**. Don't ship "880 passing, 4 known-failing" — known-failing tests rot.
- [ ] No `it.skip` / `describe.skip` / `it.only` / `describe.only` accidentally committed. Quick check:
  ```bash
  grep -rE "\\b(it|describe)\\.(only|skip)\\b" tests/unit/
  ```
- [ ] **New tests for new code**: any new function/handler in this release has at least one regression test in `tests/unit/`. Bug fixes carry a test that fails on the previous code and passes on the new.
- [ ] **Mock-update audit**: when changing a function's call signature inside a chain (e.g., adding `ensureElementResolved` to pattern handlers), every spec file that mocks that chain needs to be updated. Symptom: tests pass for unrelated reasons. Run the full suite, watch for tests where the *changed* command isn't asserted in the captured `commands[]` list.
- [ ] **Type check** (separate from build): `npx tsc --noEmit` clean (build can succeed while still emitting silent type warnings if `tsBuildInfoFile` is stale).

## 4. Dependency sanity

This is the step that would have caught the 1.1.9 → 1.1.10 hotfix.

- [ ] **Imports vs declared deps audit**:
  ```bash
  # Every runtime import (excludes type-only):
  grep -rhE "^import [^t].*from '[^.\\/]" lib/ | grep -oE "'[^']+'" | sort -u
  # Every require() call (catches dynamic loads):
  grep -rE "require\\(['\\\"][^.][^/]" lib/
  ```
  Cross-reference against `package.json` `dependencies` + `peerDependencies` + `optionalDependencies`. Anything imported eagerly that isn't declared = future user-side `Cannot find module` on a clean install.
- [ ] Decide for each new external dep:
  - Used always at runtime → `dependencies`
  - Used always at runtime, but always provided by host → `peerDependencies` (Appium ecosystem typically uses this for `appium`, `@appium/base-driver`)
  - Only used by an opt-in feature (recording, etc.) → `optionalDependencies` **AND** lazy-`require()` inside the function that uses it
  - Build/test only → `devDependencies`
- [ ] **Compiled output audit** (catches type-only-vs-value imports the source-grep misses):
  ```bash
  grep -rhE "require\\(['\\\"][^.\\/]" build/lib/
  ```
  Anything here that isn't in deps/peerDeps/optionalDeps = bug.
- [ ] `npm ls` returns clean (no `UNMET PEER DEPENDENCY` for the documented support range).
- [ ] `npm audit` — review high/critical vulns. Document any deferred ones.

## 5. Package manifest

- [ ] `package.json` `files` field includes **only what should ship**: `build/`. Should NOT include `lib/` (TS sources), `tests/`, `docs/`, `scripts/`, `node_modules/`, log files.
- [ ] `package.json` `main` field points at the compiled entry: `build/lib/driver.js`.
- [ ] `package.json` `appium.driverName` / `automationName` / `mainClass` match the source.
- [ ] License field accurate. License file present.
- [ ] Repository URL valid (test it loads in a browser).
- [ ] Engines field accurate if specified — Node ≥ 18 recommended for current Appium 3.

## 6. Pack preview

The closest thing to "what will users actually receive" without publishing.

- [ ] `npm pack --dry-run` and inspect the file list. Should be:
  - `LICENSE`, `README.md`, `package.json`
  - `build/lib/**/*.js` + `*.d.ts` + `*.js.map` + `*.d.ts.map`
  - **No** `lib/*.ts`, `tests/`, `docs/`, `scripts/`, `node_modules/`, `.env`, `.git*`, IDE folders
- [ ] Tarball **size sanity-check** — pre-1.1.9 was ~180 KB, ~880 KB unpacked. Sudden 10× growth = something leaked into the package.
- [ ] No `.npmrc` / credential / secret files in the listing.
- [ ] `package.json` repository.url normalizes cleanly (npm warns if it auto-corrects — fix at source rather than rely on the auto-correction).

## 7. Documentation

- [ ] `CHANGELOG.md` has an entry for the new version dated today, organised by section (Features / Bug Fixes / Refactoring / Tests / Docs).
- [ ] If the release is large enough, `docs/releases/<ver>.md` has a longform write-up.
- [ ] `docs/code-review/<date>.md` tracker (if relevant) has any closed findings marked 🟢 with the commit hash, and notes any follow-ups deferred to a future release.
- [ ] README install snippet still works (`npm install <pkg>@<new-version>`).
- [ ] If any user-facing command changed shape, the relevant page under `docs/` is updated.
- [ ] GitHub Release notes drafted (can use `docs/releases/v<ver>-github-release.md` as a workspace; not part of the npm tarball).

## 8. Cross-environment smoke test (clean install, not local dev tree)

This is the step that would have caught `Cannot find module 'asyncbox'` before users hit it.

- [ ] **Fresh-install dry run on a separate machine or fresh container**:
  ```powershell
  # On a fresh VM or a node_modules-cleaned dir, NOT the dev machine
  npm install <pkg>@<new-version>
  # Verify the install resolved without errors and contains exactly what you expect
  ls node_modules/<pkg>/build
  ```
- [ ] **Driver-load test**: install via Appium and start the server.
  ```powershell
  appium driver install --source=npm <pkg>@<new-version>
  appium --relaxed-security
  ```
  Confirm `Available drivers: <pkg>@<ver>` appears with no `Could not load driver` error.
- [ ] **Session smoke**: create a session with `appium:app: 'root'`, get page source, delete session. Should round-trip without errors.
- [ ] **Architecture coverage** for projects targeting both x64 and ARM64: run the smoke test on both. ARM64 install must succeed even with `optionalDependencies` skipped.
- [ ] If shipping a fix for a specific bug: re-run the original repro and confirm it's resolved.

> **Note on testing the unpublished tarball**: `npm pack` produces a `.tgz`. You can install it on a fresh VM via `npm install ./<pkg>-<ver>.tgz` to validate **before** the actual `npm publish`. This is the strongest pre-publish guarantee — same artifact users get, just delivered locally.

## 9. Git state

- [ ] `git status` clean — every change in this release is committed.
- [ ] On expected branch (typically `main`).
- [ ] Pulled latest from origin (no race with another contributor's commit).
- [ ] Tag the commit: `git tag v<new-version>`.
- [ ] **Don't push the tag yet** — push it after a successful `npm publish` so a publish failure doesn't leave a tag pointing at an unpublishable commit.

## 10. Publish

- [ ] `npm whoami` confirms auth (or `~/.npmrc` has the right token).
- [ ] **`npm publish --dry-run`** — last preview, double-check tarball contents and version.
- [ ] **`npm publish`** (or `npm publish --tag next` for pre-release).
- [ ] Verify availability:
  ```bash
  npm view <pkg> version
  npm view <pkg> dist.tarball
  ```
  Both should show the new version.

## 11. Post-publish

- [ ] `git push origin main` (commits pushed if not already).
- [ ] `git push origin v<new-version>` (tag now safe to push since the publish succeeded).
- [ ] Create GitHub Release: `gh release create v<new-version> --title "v<new-version>" --notes-file docs/releases/v<new-version>-github-release.md`.
- [ ] **Re-run the §8 smoke test** against the actual published version (not the local tarball) to catch any registry-side issues (rare but possible).
- [ ] Update downstream projects whose `requirements.txt` / `package.json` / equivalent pinned the old version (e.g. `secureage-windows/requirements.txt`).
- [ ] If any temporary auth tokens were used inline (e.g. pasted into a session, written to a temp `.npmrc`), **revoke them now** at https://www.npmjs.com/settings/<user>/tokens.
- [ ] If a recent VM was running the linked-from-source driver from `build_deploy_restart.ps1`, optionally redeploy with the published version so VM state matches what users see.

## 12. Rollback / hotfix paths

- [ ] **`npm publish` is essentially irreversible** — the same `<name>@<version>` cannot be re-published with different content. `npm unpublish` only works within 72 hours and only if no other package depends on the version. Plan accordingly.
- [ ] If a critical regression ships:
  1. **Don't** unpublish — that breaks anyone who already pulled the version.
  2. **Bump patch** (`1.1.10 → 1.1.11`), fix, run this checklist again.
  3. Optionally `npm deprecate <pkg>@<bad-version> "<reason — please upgrade>"` so future installs see a warning.
- [ ] Keep the previous N versions installable. Don't unpublish or deprecate them aggressively.

---

## When the checklist itself fails

If a step finds an issue:
1. **Stop** — don't proceed to publish.
2. Fix on a new commit (don't amend a tagged commit unless you also move the tag).
3. Re-run the checklist from the failed step **forward**, not from the top — you don't need to re-review architecture if you only added a missing dep.
4. Document the gap in [`docs/code-review/<date>.md`](../code-review/) so the next release explicitly checks it.

## Lessons baked in (from past hotfixes)

| Date | Hotfix | Why this checklist now catches it |
|---|---|---|
| 1.1.9 → 1.1.10 | `Cannot find module 'asyncbox'` on fresh `appium driver install` | §4 (imports vs declared deps audit), §6 (`npm pack --dry-run`), §8 (clean-install smoke test on a separate machine) |
