# Appium NovaWindows2 Driver Documentation

Welcome to the **appium-novawindows2-driver** documentation! This is an [Appium](https://appium.io) driver for automating **Windows desktop applications** using the Microsoft UI Automation (UIA) framework via PowerShell.

## Overview

The `NovaWindows2Driver` extends Appium's `BaseDriver` and communicates with Windows applications through a persistent PowerShell session that leverages `System.Windows.Automation` APIs.

## Documentation Pages

| Page | Description |
|---|---|
| [Capabilities](./capabilities.md) | All supported driver capabilities (`appium:xxx`) |
| [Finding Elements](./finding-elements.md) | Supported locator strategies and examples |
| [Element Commands](./element-commands.md) | Commands to interact with elements |
| [App Commands](./app-commands.md) | Window management, page source, screenshots |
| [Extension Commands](./extension-commands.md) | `windows:` custom commands (click, hover, scroll, patterns, etc.) |
| [Action Sequences](./action-sequences.md) | W3C Actions API – keyboard, mouse, wheel |
| [PowerShell Commands](./powershell-commands.md) | Executing raw PowerShell scripts |
| [Screen Recording](./screen-recording.md) | Recording the screen during a test session |

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

- **OS**: Windows only
- **Appium**: v2.x
- **Node.js**: v18+
- **PowerShell**: 5.1+ (included with Windows)

## Installation

```bash
npm install appium-novawindows2-driver
# or register it as an Appium plugin:
appium driver install --source npm appium-novawindows2-driver
```
