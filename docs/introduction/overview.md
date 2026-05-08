# Project Overview

`appium-novawindows2-driver` is an [Appium 3](https://appium.io) driver for automating **Windows desktop applications**. It talks to applications through Microsoft's **UI Automation (UIA)** framework using a **persistent PowerShell session** as the automation backend.

No WinAppDriver. No Developer Mode. No extra services. Just Appium + this driver + Windows + PowerShell (which is already installed).

## Why this exists

Windows desktop automation has historically had three chronic pain points:

1. **Slow element lookups.** XPath across deep, complex UI trees can take seconds per query in the standard stack — unworkable for any non-trivial test suite.
2. **Hidden / off-tree elements.** Elements filtered out by the default `ControlView` / `ContentView` are hard or impossible to reach from existing drivers.
3. **Keyboard input quirks.** Wrong characters under non-US layouts, dropped characters during fast typing, no per-character delay control.

This driver attacks all three:

- An in-repo W3C-compliant **XPath 1.0 engine** that pushes common predicates (`contains()`, `starts-with()`) into PowerShell to avoid enumerating the whole tree in JS.
- A **`windows: cacheRequest`** extension exposing UIA's `CacheRequest` so callers can switch traversal to **RawView** (where filtered-out elements live) and bulk-cache properties.
- Custom **keyboard input** built on `SendInput` with proper Unicode handling, optional per-character delays, and modifier-key state tracking that survives across calls.

## What it automates

The driver targets the four major Windows UI stacks:

- **UWP** (Universal Windows Platform) apps
- **WPF** (Windows Presentation Foundation) applications
- **WinForms** applications
- **Classic Win32** desktop applications

Mixed apps work too — the MSAA fallback chain in `getProperty` handles older controls that don't expose modern UIA properties.

## Host requirements

| Requirement | Detail |
|---|---|
| **OS** | Windows 10 or later — desktop SKUs (10/11) and Server (2019/2022/2025) |
| **Architecture** | x64 + ARM64 (recording stack is optional on ARM64 — see [enterprise focus](./enterprise-focus.md#screen-recording-x64-only)) |
| **Appium** | v3.x (peer dep) |
| **Node.js** | v18+ |
| **PowerShell** | 5.1+ — ships with Windows |

No Developer Mode toggle, no service install, no admin elevation for the driver itself.

## Quick architecture sketch

```
┌──────────────────────────────────────────────────────────┐
│  Appium 3 server                                         │
│    └─ NovaWindows2Driver (extends BaseDriver)            │
│         ├─ commands/  — W3C + windows:* command handlers │
│         ├─ powershell/ — PowerShell DSL + Win32Helper    │
│         ├─ xpath/      — XPath 1.0 → UIA Condition       │
│         └─ winapi/     — koffi FFI to user32 / kernel32  │
└──────────────────────────────────────────────────────────┘
                         │  stdin/stdout
                         ▼
┌──────────────────────────────────────────────────────────┐
│  PowerShell child process (one per driver session)       │
│    └─ System.Windows.Automation + custom cmdlets         │
│       (Find-*, Get-LegacyPropertySafe, Win32Helper.dll)  │
└──────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│  UI Automation / MSAA → target Windows application       │
└──────────────────────────────────────────────────────────┘
```

Key properties of this design:

- **One PowerShell process per Appium session** — no shared state across sessions, parallel sessions don't interfere.
- A **command queue** serialises PS I/O within a session so callers can issue commands concurrently from a test without races.
- **Auto-restart** of the PS process if it dies mid-session — the next command transparently re-spawns it (1.1.9+).
- **Native calls via koffi** for things UIA can't reach: DPI awareness, `SendInput`, `EnumWindows`. No N-API addons; nothing to compile.
- **`Win32Helper`** (a small embedded C# class) is compiled at runtime inside the PS session for MSAA fallback and window-management primitives — no external DLL.

For the full layered picture, see [Architecture / Overview](../architecture/overview.md). For per-module breakdowns, see [Architecture / Components](../architecture/components.md).

## Fork rationale

This project is a fork of [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver), kept under the **`novawindows2`** name + `automationName: "NovaWindows2"` so it can be installed alongside the upstream driver on the same Appium server.

The fork diverged in late 2026-Q1 to focus on:

- **XPath correctness and performance** — the upstream's XPath was good for simple cases but fell over on enterprise UIs with deep dialogs and dense lists. The fork rewrote the engine in TypeScript with a 311-case unit-test suite (515 assertions).
- **PowerShell-backend robustness** — UTF-8 encoding pinned on both sides, `-NoProfile` to avoid user-profile pollution, multi-PID grace period during slow app launches, transparent auto-restart after a UIA crash takes the PS process down.
- **A deep unit-test suite** (currently 880 passing) — the XPath engine, every PS DSL primitive, every command handler, every error path is unit-tested without needing a Windows host.

The fork tracks upstream releases — see [Comparison](./comparison.md) for what's been merged, what's been deliberately skipped, and why.

## Where to next

| You want to… | Read |
|---|---|
| See what makes this driver suited for enterprise-grade testing | [Enterprise focus](./enterprise-focus.md) |
| Compare against upstream / `appium-windows-driver` / WinAppDriver | [Comparison](./comparison.md) |
| Understand the codebase | [Architecture](../architecture/overview.md) |
| Use the driver — capabilities, locators, commands | [Capabilities](../reference/capabilities.md), [Finding Elements](../reference/finding-elements.md), [Commands](../reference/commands.md), [Extensions](../reference/extensions.md) |
| Build / deploy / test it | [Build](../development/build.md), [Deploy](../development/deploy.md), [Testing](../development/testing.md) |
