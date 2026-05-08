# Comparison

How `appium-novawindows2-driver` compares to its three closest neighbours: the **upstream** it was forked from, the **legacy `appium-windows-driver`**, and **WinAppDriver** (Microsoft's original).

## At-a-glance

| Feature | **novawindows2** (this fork) | **novawindows** (upstream) | **appium-windows-driver** | **WinAppDriver** |
|---|---|---|---|---|
| Automation backend | UIA via persistent PowerShell | UIA via persistent PowerShell | WinAppDriver under the hood | Native UIA via Microsoft service |
| Service install required | No | No | Yes (WinAppDriver) | Yes (separate exe + Developer Mode) |
| Developer Mode required | No | No | Yes | Yes |
| Fresh-install footprint | ~880 KB unpacked | similar | + WinAppDriver | + WinAppDriver service |
| ARM64 support | ✅ (recording optional) | ✅ | partial | ❌ |
| WebView2 / Chromium contexts | ❌ (deliberately skipped) | ✅ (since 1.4.0) | ❌ | ❌ |
| XPath engine | In-repo W3C 1.0 (1,300 LOC, 311-case suite) | In-repo (smaller suite) | WinAppDriver's | WinAppDriver's |
| RawView / hidden elements | ✅ via `windows: cacheRequest` | ✅ | partial | ❌ |
| MSAA fallback for legacy controls | ✅ 6-layer resolution chain in `getProperty` | ✅ basic | partial | ❌ |
| Persistent PS session auto-restart | ✅ (1.1.9+) | ❌ | n/a | n/a |
| Multi-PID launch grace period | ✅ | ❌ (single PID) | ❌ | ❌ |
| Unicode keyboard input | ✅ via `SendInput` + Unicode flag | ✅ | partial | partial |
| Per-character `typeDelay` + inline `[delay:N]` prefix | ✅ | ❌ | ❌ | ❌ |
| Smooth pointer movement (cubic-bezier) | ✅ | ❌ | ❌ | ❌ |
| Screen recording | ✅ (FFmpeg, optional on ARM64) | ✅ (1.4.0 auto-download) | ❌ | ❌ |
| PowerShell escape hatch | ✅ shared + isolated modes | ✅ | ❌ | ❌ |
| Maintenance | Active (SecureAge) | Active (AutomateThePlanet) | Maintenance mode | Archived |
| Status | Production | Production | Maintenance | [Archived](https://github.com/microsoft/WinAppDriver) |

## vs upstream `appium-novawindows-driver`

This project is a **direct fork** of [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver). The fork uses a different package name (`appium-novawindows2-driver`) and different `automationName` (`NovaWindows2`) so both can be installed alongside each other on the same Appium server.

### What this fork added

- **XPath engine rewrite** — full W3C XPath 1.0 in-repo, with 311 unit-tested cases (515 assertions). Push-down of `contains()` / `starts-with()` to the PowerShell side. Correct predicate ordering (e.g. `[1][contains()]` picks position first, then filters — many drivers got this backwards).
- **`AutomationElement` DSL** in [`lib/powershell/elements.ts`](../../lib/powershell/elements.ts) (~930 LOC) and a `Condition` AST in [`lib/powershell/conditions.ts`](../../lib/powershell/conditions.ts) — type-safe builders that produce well-formed PS commands. Reduces injection risk and makes new commands cheap to add.
- **Robust `attachToApplicationWindow`**: multi-PID iteration, grace-period prioritisation of the newest process for the first 6 attempts, all-HWNDs-per-PID via native `EnumWindows`, per-handle fallback chain (`SetForegroundWindow` → `SetFocus`). Upstream uses `processIds[0]` only.
- **PS session UTF-8 hardening**: pin `$OutputEncoding` *and* `[Console]::OutputEncoding`, `-NoProfile` to avoid user-profile pollution. Upstream pins only stderr encoding.
- **Auto-restart** of the PS session (1.1.9+) — persistent state recovers transparently after a UIA crash. Upstream has no recovery path.
- **`getProperty` 6-layer resolution chain** including legacy MSAA shorthand aliases and explicit `LegacyIAccessible.<Property>` dot-notation. Upstream supports a subset.
- **`pushFile` payload validation** (1.1.9+) — base64-charset check before PS interpolation closes a PS-injection vector.
- **880-test unit suite** runnable on Linux without an Appium server. Upstream's tests need a Windows host.
- **Detailed in-repo docs** under [`docs/`](../) covering capabilities, locators, commands, extensions, architecture, build/deploy/test workflow, and a code-review tracker. Upstream's docs are README-only.

### Deliberately skipped

Some upstream features were deliberately not merged:

| Upstream feature | Skipped because |
|---|---|
| **WebView2 / Chromium integration** (1.4.0) | Pulls in `appium-chromedriver` as a hard dep, doubles install footprint. Out of scope for this fork. Re-evaluable if a use case appears. |
| **FFmpeg auto-download** (1.4.0) | No prebuilt FFmpeg binary exists for Win-ARM64, so the auto-download path doesn't help the fork's primary deployment target. The fork's `optionalDependencies` approach is strictly safer for ARM users. |
| **Upstream's simpler `attachToApplicationWindow`** (1.3.1 / 1.4.0) | Adopting it would regress the fork's multi-PID grace-period logic. |
| **Stderr-only UTF-8 fix** (1.3.1) | The fork already pins both `stdout` and `stderr` UTF-8 at both Node and PS sides, plus `-NoProfile`. Already strictly better. |

For per-version detail of what's been merged, see [`docs/project-overview.md`](../project-overview.md) §10 and [`docs/releases/`](../releases/).

### When to choose upstream over this fork

- You need **WebView2 / Chromium-context** automation (web-inside-desktop apps like Electron or in-app browsers).
- You're already invested in upstream's release cadence and don't need the fork's hardening for your use case.

For everything else — especially deep, complex, mixed-stack enterprise UIs — this fork is the better fit.

## vs `appium-windows-driver` (legacy)

[`appium-windows-driver`](https://github.com/appium/appium-windows-driver) is the older Appium driver for Windows. It delegates to **WinAppDriver** internally. The migration path from it to this driver was the original reason this project exists.

| | `appium-windows-driver` | **novawindows2** |
|---|---|---|
| Backend | WinAppDriver (subprocess) | UIA via PowerShell (subprocess) |
| Service install | Yes (WinAppDriver service) | No |
| Developer Mode | Yes | No |
| XPath performance | WinAppDriver's (slow on deep trees) | Push-down + in-repo engine |
| Hidden / RawView elements | Limited | `windows: cacheRequest` exposes RawView |
| Native ARM64 | Partial (depends on WinAppDriver) | Native, `koffi` instead of N-API |
| Force-quit a hung app | Manual | `ms:forcequit` capability |
| Slow-launch attachment | Manual | `ms:waitForAppLaunch` |
| Per-character type delay | No | `appium:typeDelay` + `[delay:N]` prefix |
| Smooth mouse easing | No | `appium:smoothPointerMove` |

### What changed in the migration

Capability changes a test config typically needs (see [Capabilities](../reference/capabilities.md) for the full list):

```json
{
  "platformName": "Windows",
  "appium:automationName": "NovaWindows2",
  "ms:waitForAppLaunch": 3,
  "ms:forcequit": true
}
```

Most other capability names (`appium:app`, `appium:appArguments`, `appium:appWorkingDir`, etc.) are unchanged. Locator strategies (`accessibility id`, `xpath`, `name`, `class name`, `tag name`) are the same.

The one significant change in test code: `getAttribute()` is deprecated in favour of `getProperty()`. The old name still works but logs a deprecation warning.

### Migration benefits observed

These are the real-world wins reported during migration of an enterprise test suite:

- **Performance**: PowerShell-level XPath filtering for `contains` / `starts-with`; reduced lookup times via optimised recursive search; standardised extension command set.
- **Stability**: MSAA/UIA hybrid protection with PID validation; auto-focus + `SetForegroundWindow` for target elements; corrected NaN/boolean/Infinity coercion in PS responses.
- **New capability surface**: RawView access, integrated screen recording, smooth pointer easing, per-action type delays, 20+ UIA patterns wired up.
- **Deployment**: no Developer Mode, no separate service install, runtime compilation of `Win32Helper.dll` (no external DLL to ship).

## vs WinAppDriver (Microsoft, original)

[WinAppDriver](https://github.com/microsoft/WinAppDriver) is the original Microsoft-built WebDriver server for Windows. It's been **archived** as of 2024.

| | WinAppDriver | **novawindows2** |
|---|---|---|
| Maintenance | Archived | Active |
| Architecture support | x86, x64 | x64, ARM64 |
| Service model | Standalone service exe | In-process Appium driver |
| Developer Mode | Required | Not required |
| W3C compliance | JSONWP + partial W3C | Full W3C (Appium 3) |
| XPath | Implementation-specific | Full W3C XPath 1.0 |
| MSAA fallback | None | 6-layer resolution chain |
| Modern Windows features (Win11) | Stale (no updates since archive) | Current |

If you're using WinAppDriver today, the migration story is the same as `appium-windows-driver` above (since `appium-windows-driver` was just a thin wrapper) — see [Migration capability changes](#what-changed-in-the-migration).

## When to use which

| Use case | Recommended |
|---|---|
| Enterprise mixed-stack desktop suite (UWP + WPF + WinForms + Win32) | **novawindows2** |
| Test must run on Win-ARM64 hardware | **novawindows2** |
| Test target embeds a WebView2 / Chromium control | upstream `novawindows` |
| Existing WinAppDriver / `appium-windows-driver` test suite | migrate to **novawindows2** |
| Greenfield Appium-on-Windows project | **novawindows2** |
| Need native+web context switching beyond WebView2 | None of the above — use Selenium/Playwright with platform-specific drivers |

## See also

- [Project Overview](./overview.md) — what this driver is and why it exists
- [Enterprise Focus](./enterprise-focus.md) — feature-by-feature, pinned to capabilities/extensions
- [`docs/project-overview.md`](../project-overview.md) §9–10 — full per-version upstream-merge log
- [`docs/releases/`](../releases/) — what landed in each release
