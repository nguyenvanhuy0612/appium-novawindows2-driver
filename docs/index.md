# Appium NovaWindows2 Driver Documentation

An [Appium](https://appium.io) driver for automating **Windows desktop applications** through Microsoft's UI Automation framework, backed by a persistent PowerShell session — no WinAppDriver, no Developer Mode, no extra services.

Forked from [`AutomateThePlanet/appium-novawindows-driver`](https://github.com/AutomateThePlanet/appium-novawindows-driver) and focused on enterprise-application automation: deep XPath performance, RawView / hidden-element access, MSAA fallback for legacy controls, persistent-session reliability, robust keyboard input under non-US locales, optional screen recording.

## Documentation map

The docs are organized by audience and purpose.

### 1. Introduction — *what this driver is, why it exists*

| Page | Description |
|---|---|
| [Overview](./introduction/overview.md) | Project purpose, three pain-points it solves, quick architecture sketch |
| [Enterprise focus](./introduction/enterprise-focus.md) | Features pinned to enterprise-app concerns |
| [Comparison](./introduction/comparison.md) | Vs upstream, vs `appium-windows-driver`, vs WinAppDriver |

### 2. Architecture — *how it's built*

| Page | Description |
|---|---|
| [Overview](./architecture/overview.md) | Three-layer model, request flows, design rationale |
| [Components](./architecture/components.md) | Per-directory walkthrough of `lib/` |
| [PowerShell session](./architecture/powershell-session.md) | Spawn flow, command queue, auto-restart, failure modes |
| [API inventory](./architecture/api-inventory.md) | Function-level inventory of every module |

### 3. Reference — *the API surface*

| Page | Description |
|---|---|
| [Capabilities](./reference/capabilities.md) | All supported driver capabilities (`appium:` / `ms:` prefixed) |
| [Finding Elements](./reference/finding-elements.md) | Locator strategies, XPath usage, UIA condition DSL |
| [Commands](./reference/commands.md) | W3C-protocol commands — app/window, element, action sequences |
| [Extensions](./reference/extensions.md) | `windows:*` extension commands, PowerShell escape hatch, screen recording |
| [Error codes](./reference/error-codes.md) | WebDriverException → driver cause map |

### 4. Development — *building, deploying, testing the driver*

| Page | Description |
|---|---|
| [Build](./development/build.md) | Local clone, install, build, source layout |
| [Deploy](./development/deploy.md) | `build_deploy_restart.ps1` walkthrough, flags, troubleshooting |
| [Testing](./development/testing.md) | Unit / smoke / E2E test layers, conventions |
| [Release process](./development/release-process.md) | Pre-publish checklist for npm releases |

### Engineering tracking

| Page | Description |
|---|---|
| [Code review tracker](./code-review/) | Static-review findings + fix status per release |
| [Releases](./releases/) | Per-version detailed change notes |

## Quick Start

```js
import { remote } from 'webdriverio';

const driver = await remote({
  hostname: 'localhost',
  port: 4723,
  capabilities: {
    platformName: 'Windows',
    'appium:app': 'C:\\Windows\\System32\\notepad.exe',
    'appium:automationName': 'NovaWindows2',
  },
});

const editField = await driver.$('//Edit');
await editField.setValue('Hello, World!');
await driver.deleteSession();
```

## Requirements

- **OS**: Windows 10 / 11 / Server 2019+ / 2022 / 2025 (x64 + ARM64)
- **Appium**: v3.x (peer dep)
- **Node.js**: v18+
- **PowerShell**: 5.1+ (ships with Windows)

## Installation

```bash
npm install appium-novawindows2-driver
# or register it as an Appium driver:
appium driver install --source=npm appium-novawindows2-driver
```

> **Note (ARM64):** Screen recording (`ffmpeg-static`, `asyncbox`, `teen_process`) is in `optionalDependencies` because no prebuilt FFmpeg binary exists for Win-ARM64. The driver itself loads cleanly on ARM64; only the recording calls fail with an actionable error if the optional stack isn't installed.
