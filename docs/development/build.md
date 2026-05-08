# Build

How to build `appium-novawindows2-driver` from source.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | LTS recommended |
| npm | ≥ 9 | Ships with Node ≥ 18 |
| Git | any recent | For cloning + commit hooks |
| TypeScript | bundled | Pulled in via `devDependencies`; no global install needed |

The project is pure TypeScript with no native build step — `koffi` and `ffmpeg-static` ship prebuilt binaries, so you don't need a C/C++ toolchain.

## First-time setup

```bash
git clone https://github.com/nguyenvanhuy0612/appium-novawindows2-driver.git
cd appium-novawindows2-driver
npm install
```

`npm install` resolves both runtime and `devDependencies`. Build dependencies (TypeScript, ts-node, mocha, etc.) come from `devDependencies`. Runtime peer deps `appium` and `@appium/base-driver` are installed too — they're listed under `devDependencies` so they're available for unit tests, and treated as `peerDependencies` for consumers.

## Build

```bash
npm run build
```

Runs `tsc -b` (TypeScript project-references build mode). Compiles `lib/**/*.ts` → `build/lib/**/*.{js,d.ts,js.map,d.ts.map}`.

The `tsconfig.json` extends `@appium/tsconfig`, sets `outDir: build`, enables `esModuleInterop`, and keeps `strict: false` (the project relies on selective `any` casts in a few hot paths).

Build is incremental — re-running after a small change rebuilds only what's affected. The build state lives in `build/tsconfig.tsbuildinfo`.

## Watch mode

For active development:

```bash
npm run watch
```

Runs `tsc -b --watch`. Recompiles on every save. Combine with the deploy script's `-SkipBuild` flag for fast iteration loops:

```bash
# Terminal 1 — watch + recompile
npm run watch

# Terminal 2 — push the latest build to a VM after each change
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM-IP> -SkipBuild -SkipInstall
```

## Lint

```bash
npm run lint
```

Runs ESLint with `@appium/eslint-config-appium-ts` rules. Currently advisory — CI does not block on lint failures, but PRs should land with a clean run.

## Output layout

After `npm run build`, `build/` contains:

```
build/
├─ eslint.config.{mjs,d.mts}      ESLint config artifacts (ignored by npm publish)
├─ tsconfig.tsbuildinfo            tsc incremental state (ignored by npm publish)
└─ lib/
   ├─ driver.js + .d.ts            Main entry — package.json "main" points here
   ├─ commands/                    Command handlers (W3C + windows:*)
   ├─ powershell/                  PowerShell DSL + Win32Helper
   ├─ winapi/                      koffi FFI bindings
   ├─ xpath/                       XPath 1.0 engine
   ├─ constants.js / enums.js / util.js / constraints.js
```

Only `build/` ships to npm — see [`package.json`](../../package.json) `files` field.

## Source layout

| Path | Role |
|---|---|
| `lib/driver.ts` | `NovaWindows2Driver` class (extends `BaseDriver`) |
| `lib/commands/` | Command handlers, one file per topic |
| `lib/powershell/` | PowerShell DSL — `pwsh` template, `PSObject` subtypes, `Condition` AST, `AutomationElement` builders, `Win32Helper` C# embedding |
| `lib/xpath/` | XPath 1.0 → UIA `Condition` mapper |
| `lib/winapi/` | Win32 API bindings via koffi |
| `lib/constraints.ts` | Capability constraints + validation |
| `lib/enums.ts` | Shared constants — `Key`, `ClickType` |
| `lib/util.ts` | Common helpers — `parseRectJson`, `sleep`, `$()` template factory, `getBundledFfmpegPath` |
| `tests/unit/` | mocha + chai unit tests (880 passing) |
| `tests/e2e/` | mocha + WDIO end-to-end tests (require running Appium server) |
| `tests/all_e2e/` | Broader E2E coverage organised by feature area |
| `scripts/local/` | Local automation: deploy script, log puller |

For a function-level inventory see [`docs/architecture/api-inventory.md`](../architecture/api-inventory.md).

## Common errors

**`error TS2307: Cannot find module '@appium/base-driver'`**
Did you skip `npm install`? Or your `node_modules` was wiped (e.g. by `npm cache clean`). Re-run `npm install`.

**Build succeeds but old code runs at runtime**
Stale `build/tsconfig.tsbuildinfo`. Delete `build/` and rebuild:
```bash
rm -rf build && npm run build
```

**`TS5042: Cannot find a tsconfig.json file at the specified directory`**
You're not in the project root. `cd` to where `package.json` lives.

**Watch mode ignores changes to `eslint.config.mjs`**
Expected — only `lib/` is in `tsconfig.json`'s `include`. Restart watch if you change config files.
