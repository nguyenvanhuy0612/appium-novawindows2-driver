# Disabled GitHub Actions Workflows

These workflow files have been moved out of `.github/workflows/` so GitHub
Actions no longer picks them up. The contents are preserved here for reference
and for re-enabling later.

| File | What it did | When it ran |
|---|---|---|
| `lint-build.yml` | `npm install --no-package-lock` → `npm run lint` → `npm run build` on Ubuntu Node 24 | Pull request to `main` / `develop` |
| `release.yml` | `npm install`, `build`, `lint`, `npm prune --omit=dev --omit=peer` (presumably followed by publish, file was truncated when last reviewed) | `workflow_dispatch` or push to `main` / `develop` |

## Why disabled

User decision, 2026-05-12. Not a problem with the workflows themselves —
deliberate choice to pause automated CI/release.

## Limitations these workflows had

If/when you re-enable, keep in mind the gaps the previous reviews flagged
(see [`docs/development/stable-readiness-review.md` §5](../../docs/development/stable-readiness-review.md#5-builddeployrelease-assessment)):

- **`npm test` was NOT run** — only lint and build. Unit-test regressions could merge silently.
- **E2E tests were NOT run** — would need a `windows-latest` job with Appium installed and a real PowerShell process running.
- **No PSScriptAnalyzer** — the ~1,400 LOC of embedded PowerShell strings across `lib/**/*.ts` had zero static checking. Root cause of the 1.1.11 → 1.1.12 hot-fix.

[`docs/development/phase-2-stable-plan.md`](../../docs/development/phase-2-stable-plan.md)
§Day 1 has concrete steps for addressing those gaps if/when CI is re-enabled.

## How to re-enable

```sh
git mv .github/workflows.disabled/lint-build.yml .github/workflows/
git mv .github/workflows.disabled/release.yml .github/workflows/
git commit -m "ci: re-enable workflows"
git push
```

GitHub Actions picks up workflow files within ~minutes of the push appearing
on a branch with the appropriate triggers. No additional configuration needed
on the repo side.
