# Testing

Three test layers, each with a different purpose, scope, and runtime cost.

| Layer | Where | Runtime | Needs Appium? | When to run |
|---|---|---|---|---|
| Unit | `tests/unit/*.spec.ts` | ~300 ms total | No | Every commit, before push |
| E2E | `tests/e2e/*.e2e.spec.ts`, `tests/all_e2e/*.e2e.spec.ts` | seconds to minutes | Yes — running on a real Windows host | Before merging changes that touch driver behaviour |
| Smoke | manual or scripted | ~30 sec | Yes | Before publishing to npm (see [release-process.md](./release-process.md) §8) |

## Unit tests

Pure-JS unit tests using **mocha + chai + ts-node**. They mock `sendPowerShellCommand` so no Appium server, no Windows host, no network — runs anywhere Node 18+ runs.

### Running

```bash
npm test
```

This executes: `mocha -r ts-node/register tests/unit/**/*.spec.ts`

Expected output: **880 passing**, **0 failing**, ~300 ms.

### What's covered

| Spec | Scope |
|---|---|
| `xpath-comprehensive.spec.ts` | 311 XPath cases in 30 groups (515 assertions). Predicate ordering, axes, all XPath 1.0 functions, push-down to PS-side filters |
| `xpath.spec.ts` | Baseline / regression XPath tests |
| `actions.spec.ts` | W3C action sequences — key, pointer, wheel, null |
| `app.spec.ts` | W3C window/navigation surface — `title`, `maximize`, `minimize`, `back`, `forward`, `setWindowRect`, `closeApp`, `launchApp` |
| `element.spec.ts` | Element-level commands — click, setValue (modifier handling), getProperty, etc. |
| `extension.spec.ts` | `windows:*` handlers — pattern routing, error normalisation, lazy-loaded recording deps |
| `extension-routing.spec.ts` | `EXTENSION_COMMANDS` registry → handler wiring |
| `extension-validation.spec.ts` | Argument validation across `windows:*` commands |
| `powershell.spec.ts` | PS DSL — `pwsh` template, base64 wrapping, `decodePwsh` |
| `core.spec.ts` | `pwsh` / `pwsh$` deferred-template internals |
| `elements.spec.ts` | `AutomationElement` + `FoundAutomationElement` builders, `findFirst` / `findAll` |
| `conditions.spec.ts` | `PropertyCondition`, `AndCondition`, `OrCondition`, `NotCondition` |
| `converter.spec.ts` | Selector DSL parser — `Property=Value`, `And()`, `Or()`, `Rect()`, `Point()` |
| `common.spec.ts` | `PSObject` subtypes — `PSString`, `PSInt32`, `PSPoint`, `PSRect`, etc. |
| `regex.spec.ts` | Regex matchers used by the converter |
| `driver.spec.ts` | Driver-class behaviour — CSS shim, abs→rel XPath rewrite, tag-name aliases |
| `getproperty.spec.ts` | `getProperty` resolution order — pattern dot-notation, MSAA fallback |
| `wildcard_attr.spec.ts` | Wildcard attribute matching |
| `util.spec.ts` | `parseRectJson`, `assertSupportedEasingFunction`, `$()` template factory |

### Mock convention

All unit tests use a small `makeMock()` helper that captures every `sendPowerShellCommand` call into a `commands` array. Most assertions look like:

```ts
const { mock, commands } = makeMock({ /* response queue or default */ });
await someHandler.call(mock, args);
expect(commands[N]).to.contain('expected PS substring');
```

When a handler now goes through `resolvePatternElement` (e.g. all pattern handlers since 1.1.9), `commands[0]` is the **`ensureElementResolved` cache check** (`$null -eq $elementTable[...]`) and `commands[1+]` are the real pattern calls. Tests that inspect a specific call must account for this — either:

```ts
// Default response '' makes the cache check return '' (falsy → cache hit, short-circuit)
const { mock, commands } = makeMock();
await patternInvoke.call(mock, el('abc'));
expect(commands[1]).to.contain('InvokePattern');   // commands[0] is the cache check

// Or queue the cache-check response explicitly
const { mock } = makeMock({ responses: ['False', 'True'] });   // 'False' → cache hit, then real response
```

This convention is captured in `tests/unit/extension.spec.ts` and was the source of test breakage during the [code-review fixes for #5](../code-review/2026-05-08.md).

### Adding a new unit test

1. Add a `*.spec.ts` file under `tests/unit/`. The mocha glob picks it up automatically.
2. Import the function-under-test from `../../lib/...`.
3. Construct a mock via `makeMock()` (copy from a similar spec).
4. Bind it to the handler with `.call(mock, ...)` so `this` is the mock driver.
5. Assert against `commands[N]` for emitted PS, or against the return value, or both.
6. Bug fixes should land **with a regression test** that fails on `git stash` and passes on the new code.

### Type check separately

`npm run build` and `npm test` both type-check (`ts-node` does too), but if you want a pure type-check pass without compiling:

```bash
npx tsc --noEmit
```

## E2E tests

Real WebdriverIO + a running Appium server + a real Windows host. Tests in `tests/e2e/` and `tests/all_e2e/`.

### Running

Each suite has a script in `package.json`:

```bash
# Smoke — minimum viable session
APPIUM_URL=http://192.168.196.128:4723 npm run test:e2e:smoke

# Other suites
npm run test:e2e:xpath
npm run test:e2e:pagesource
npm run test:e2e:click
npm run test:e2e:click:root
npm run test:e2e:click:ext
npm run test:e2e:smoke:more
```

The shared mocha config is in [`tests/e2e/.mocharc.json`](../../tests/e2e/.mocharc.json):

```json
{
    "require": "ts-node/register",
    "timeout": 120000,
    "slow": 5000,
    "reporter": "spec"
}
```

### Environment variables

| Var | Default | Used by |
|---|---|---|
| `APPIUM_URL` | `http://127.0.0.1:4723` | All e2e specs — points at the Appium server |
| `TARGET_APP` | `C:\Windows\System32\notepad.exe` | Specs that need an app launched |

```bash
$env:APPIUM_URL = 'http://192.168.196.128:4723'
$env:TARGET_APP = 'C:\Program Files\YourApp\YourApp.exe'
npm run test:e2e:smoke
```

### Suite breakdown

| File | What it covers |
|---|---|
| `tests/e2e/smoke.e2e.spec.ts` | Minimum viable session — create, page source, find, attribute read, delete |
| `tests/e2e/smoke_more.e2e.spec.ts` | Broader smoke — multiple commands, modifier keys, screenshots |
| `tests/e2e/xpath.e2e.spec.ts` | XPath against a live UI tree |
| `tests/e2e/pagesource.e2e.spec.ts` | `getPageSource` on different roots |
| `tests/e2e/click.e2e.spec.ts` | Element click — coordinates, easing, foreground |
| `tests/e2e/click_root.e2e.spec.ts` | Click against `app: 'root'` (desktop root) |
| `tests/e2e/click_extension.e2e.spec.ts` | `windows: click` extension — modifiers, multi-click, drag |
| `tests/all_e2e/advanced_input.e2e.spec.ts` | Modifier handling, special keys, type delays |
| `tests/all_e2e/app.e2e.spec.ts` | App launch / close lifecycle |
| `tests/all_e2e/cache.e2e.spec.ts` | `windows: cacheRequest` — RawView vs ControlView |
| `tests/all_e2e/element.e2e.spec.ts` | Element-level operations end-to-end |
| `tests/all_e2e/interaction.e2e.spec.ts` | Hover, scroll, drag |
| `tests/all_e2e/patterns.e2e.spec.ts` | UIA pattern handlers — invoke, expand, toggle, etc. |
| `tests/all_e2e/powershell.e2e.spec.ts` | PowerShell escape hatch + isolated execution |
| `tests/all_e2e/recording.e2e.spec.ts` | `startRecordingScreen` / `stopRecordingScreen` (skips on ARM64) |
| `tests/all_e2e/search.e2e.spec.ts` | All locator strategies |
| `tests/all_e2e/system.e2e.spec.ts` | `getOrientation`, `getDeviceTime` |

### Writing a new E2E spec

The smoke spec is the canonical template — see [`tests/e2e/smoke.e2e.spec.ts`](../../tests/e2e/smoke.e2e.spec.ts):

```ts
import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';
const url = new URL(APPIUM_URL);

describe('feature — what it does', function () {
    this.timeout(120_000);
    let driver: Browser;

    before(async function () {
        driver = await remote({
            hostname: url.hostname,
            port: Number(url.port || 4723),
            path: url.pathname && url.pathname !== '/' ? url.pathname : '/',
            protocol: url.protocol.replace(':', '') as 'http' | 'https',
            logLevel: 'warn',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows2',
                'appium:app': TARGET_APP,
            },
        });
    });

    after(async function () {
        if (driver) await driver.deleteSession();
    });

    it('does the thing', async function () {
        // ...
    });
});
```

Add a script in `package.json` so others can run it: `"test:e2e:<name>": "mocha --no-config -r ts-node/register --timeout 120000 tests/e2e/<name>.e2e.spec.ts"`.

## Smoke tests (manual / pre-publish)

Distinct from the `smoke.e2e.spec.ts` automated suite. The **manual** smoke is the §8 procedure in [`release-process.md`](./release-process.md) — the kind of test that surfaces issues only a fresh-host install can hit:

1. `npm pack` to produce the actual tarball that ships to npm
2. `scp` to a fresh VM (or one with the previous version installed)
3. `tar -xzf` on the VM
4. `cd` into the unpacked dir, `npm install --omit=dev` (this is what mimics what `--source=npm` does internally)
5. `appium driver install --source=local <unpacked-dir>`
6. Start Appium, watch the loader log for `Could not load driver` errors
7. Run the smoke E2E against it: `APPIUM_URL=http://<vm>:4723 npm run test:e2e:smoke`

The 1.1.9 → 1.1.10 hotfix would have been caught by step 6 — `Cannot find module 'asyncbox'` showed up in the loader log when the published tarball was install-tested, but not in `npm test` (the dev tree had the package transitively). That's why this layer exists in addition to unit + automated E2E.

## Test data

| Path | Purpose |
|---|---|
| `tests/E2E_TEST_PLAN.md` | Hand-written test-plan checklist for live VMs — hosts, apps, scenarios |
| `tests/results/<host>/<date>/` | Per-run E2E results (`results.json`) and any defect notes |
| `tests/results/<host>/<date>/defects.md` | Optional — defect log when something failed during a test run |
| `tests/analyze/` | Session-analysis scratch — historical AI-session logs, ad-hoc investigation scripts |
| `tests/debug/`, `tests/dev_*/` | Scratch / development playgrounds for isolated experiments. Not part of the formal suites |

When committing E2E results, prefer `tests/results/<host>/<YYYY-MM-DD>/` over loose files at the top — it keeps the multi-VM, multi-day timeline navigable.

## Continuous integration

There is currently no CI workflow committed to the repo. The most useful one to add would be:

- On PR: `npm run build` + `npm test` on Node 18 / 20 / 22 (Linux is fine — no Windows-specific code paths in unit tests).
- On tag push (`v*`): build + test + `npm publish` (with the publish-process steps from `release-process.md`).

A skeleton `.github/workflows/ci.yml` would slot into this gap. Until then, run unit tests locally before every push.

## See also

- [Build](./build.md) — what `npm test` and `npm run build` actually do
- [Deploy](./deploy.md) — getting a build onto a VM where E2E tests can run against it
- [Release process](./release-process.md) — the smoke-test step before publishing
