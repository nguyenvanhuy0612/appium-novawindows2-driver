# Deploy

How to push a build to a remote Windows host running Appium, using [`scripts/local/build_deploy_restart.ps1`](../../scripts/local/build_deploy_restart.ps1).

## Why a deploy script

For day-to-day development you want to push a code change to a real VM and try it out. The deploy script automates the eight-step dance:

1. Build the project locally
2. Zip the artifacts
3. SCP the zip to the VM
4. Stop the running Appium server on the VM
5. Extract the zip into the Appium driver directory (preserving `node_modules`)
6. Run `npm install --omit=dev` on the VM (so runtime deps + optional deps are present)
7. Re-register the driver with Appium (`appium driver install --source=local`)
8. Restart Appium as an interactive Scheduled Task

Each step has been hardened by past surprises — e.g. step 6 was added after a 1.1.9 hotfix where missing `asyncbox` blocked driver load on a fresh VM.

## Prerequisites

### Local

- PowerShell 5.1+ or PowerShell 7+
- `npm`, `ssh`, `scp` on `PATH` (OpenSSH client ships with Windows 10+)
- The repo cloned

### Remote

- **OpenSSH Server** running, listening on port 22 (or `-Port` of your choice)
- **Key-based SSH auth** configured for your user (no password prompt, since the script runs many SSH commands)
- **Node.js + npm** on `PATH` for the SSH user
- **Appium 3.x** installed globally and on `PATH` (`npm install -g appium`)
- An interactive desktop session for the user (the Scheduled Task launches Appium into Session 1, not Session 0 — see [§ Scheduled Task](#8-restart-appium--scheduled-task--why) below)

> **First-time SSH key setup**: from the local box, generate a key (`ssh-keygen -t ed25519`) and append your public key to `C:\Users\<remote-user>\.ssh\authorized_keys` on the VM. Verify with `ssh <user>@<vm>` — you should reach a PowerShell prompt without entering a password.

## Quick reference

```powershell
# Full deploy (everything from step 1 to 8)
.\scripts\local\build_deploy_restart.ps1 -RemoteHost 192.168.196.128

# Iterate fast: skip npm install (reuse remote node_modules)
.\scripts\local\build_deploy_restart.ps1 -RemoteHost 192.168.196.128 -SkipInstall

# Iterate even faster: also skip local build (reuse current build/)
.\scripts\local\build_deploy_restart.ps1 -RemoteHost 192.168.196.128 -SkipBuild -SkipInstall

# Just restart the remote Appium (e.g. after editing capabilities or to clear state)
.\scripts\local\build_deploy_restart.ps1 -RemoteHost 192.168.196.128 -RestartOnly

# Push code without restarting (e.g. running tests are using the current Appium)
.\scripts\local\build_deploy_restart.ps1 -RemoteHost 192.168.196.128 -NoRestart
```

## Parameters

| Param | Default | Notes |
|---|---|---|
| `-RemoteHost` | `$env:TARGET_IP` else `192.168.196.128` | Target VM IP/hostname |
| `-RemoteUser` | `$env:TARGET_USER` else `admin` | SSH user with key-based auth |
| `-Port` | `22` | SSH port |
| `-SkipBuild` | off | Reuse the current local `build/` — useful when you already ran `npm run build` or have `npm run watch` going |
| `-SkipInstall` | off | Skip step 6 (`npm install --omit=dev` on remote). Use when no `package.json` deps changed |
| `-NoRestart` | off | Steps 1–7 only; leaves the running Appium alone |
| `-RestartOnly` | off | Only step 8 (stop + restart Appium). Skips local build, package, transfer, and registration |

The script auto-counts steps based on the chosen flags — if you pass `-SkipInstall`, the header shows `[6/7]` instead of `[7/8]`, etc.

## Environment variables

For repeat use against a single VM, set `TARGET_IP` / `TARGET_USER` once:

```powershell
$env:TARGET_IP = '192.168.196.128'
$env:TARGET_USER = 'admin'

.\scripts\local\build_deploy_restart.ps1                      # uses env defaults
.\scripts\local\build_deploy_restart.ps1 -SkipInstall         # same target, faster
```

## Step-by-step walkthrough

### 1. Build

Runs `npm install` then `npm run build` locally. Aborts on non-zero exit. Skipped with `-SkipBuild`.

### 2. Package

Zips four top-level items into `log/deploy_novawindows.zip`:
- `build/` — compiled JS + `.d.ts`
- `lib/` — TypeScript sources (useful for source-mapped debugging on the VM)
- `scripts/` — including the deploy script itself
- `*.json` — `package.json`, `tsconfig.json`, etc.

Tarball size is typically ~600 KB. Skipped only with `-RestartOnly`.

### 3. Transfer

Uses SCP to put the zip at `C:/appium/deploy_novawindows.zip` on the VM. Creates `C:/appium/` if missing.

### 4. Stop Appium

```powershell
taskkill /f /fi "windowtitle eq AppiumServer" /t
taskkill /f /im node.exe /t
Get-Process -Name powershell, pwsh | Where-Object { $_.Id -ne $PID } | Stop-Process -Force
```

The Appium server window is launched with `[Console]::Title = 'AppiumServer'` (see step 8) so it can be targeted by `taskkill /fi "windowtitle eq AppiumServer"`. The catch-all `taskkill /im node.exe` handles cases where the title was lost (e.g. after a remote crash).

### 5. Extract

```powershell
if (Test-Path $dest) {
    # Remove all but node_modules — preserves remote install state
    Get-ChildItem -Path $dest -Exclude 'node_modules' | Remove-Item -Recurse -Force
}
Expand-Archive -Path $zip -DestinationPath $dest -Force
```

Preserving `node_modules` is what makes `-SkipInstall` work on subsequent deploys.

### 6. npm install --omit=dev

Runs inside the extracted `appium-novawindows2-driver/` directory. Installs runtime + optional deps from the package's `package.json`.

The script detects whether `node_modules/@appium/base-driver` already exists and announces the path it's on (fresh install ~1–2 min, sync install ~10–30 sec). Skipped with `-SkipInstall`.

> **Why this step exists**: a `--source=local` driver registration in step 7 only symlinks; it does **not** run `npm install`. Without step 6, a fresh VM would fail to load the driver with `Cannot find module '@appium/base-driver'`. This was the root cause of the 1.1.9 → 1.1.10 hotfix.

### 7. Register driver

```powershell
appium driver uninstall novawindows2
# Clear residue: ~/.appium/node_modules/{appium-novawindows2-driver, .cache, .package-lock.json}
appium driver install --source=local C:/appium/appium-novawindows2-driver
appium driver list --installed
```

`--source=local` symlinks the driver's directory into Appium's extension registry. Combined with step 6, this gives a fully-resolved driver instance Appium can load.

### 8. Restart Appium — Scheduled Task — why?

Appium needs to drive a real desktop UI. If launched directly via SSH, it lands in **Session 0** — Windows' isolated service-only session — where it can't see or interact with any user-visible window.

The script works around this by registering an interactive Scheduled Task that runs as the currently-logged-in user, then immediately starting it:

```powershell
$u = (Get-Process explorer -IncludeUserName | Select-Object -First 1).UserName.Split('\')[-1]
$launchCmd = "[Console]::Title = 'AppiumServer'; cd ~/Desktop; appium --relaxed-security --log-level debug:debug --log appium_server.log"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoExit -Command `"$launchCmd`""
$principal = New-ScheduledTaskPrincipal -UserId $u -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName 'AppiumVisible' -Action $action -Principal $principal -Force
Start-ScheduledTask -TaskName 'AppiumVisible'
Start-Sleep 8
Unregister-ScheduledTask -TaskName 'AppiumVisible' -Confirm:$false
```

The task is unregistered after 8 seconds — by then Appium has booted and is running detached in the user session. The `[Console]::Title = 'AppiumServer'` lets step 4 of the next deploy find and kill it cleanly.

The Appium log is written to the user's desktop: `C:\Users\<user>\Desktop\appium_server.log`.

## Companion: log puller

[`scripts/local/copy_log.ps1`](../../scripts/local/copy_log.ps1) shares the same `RemoteHost` / `RemoteUser` defaults so you can chain it with deploy.

```powershell
# Copy full log to log/appium_server-<host>.log (default mode)
.\scripts\local\copy_log.ps1 -RemoteHost 192.168.196.128

# Print last 50 lines to stdout
.\scripts\local\copy_log.ps1 -RemoteHost 192.168.196.128 -Tail 50

# Live-tail (Ctrl+C to stop)
.\scripts\local\copy_log.ps1 -RemoteHost 192.168.196.128 -Follow
```

Local-file mode writes to `log/appium_server-<RemoteHost>.log`, so multi-VM workflows don't clobber each other.

## Common workflows

### Fresh VM, never deployed

```powershell
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM>
```

All 8 steps run. Step 6 is the slow one (~1–2 min) on first deploy.

### Code change, deps unchanged

```powershell
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM> -SkipInstall
```

~30 seconds end-to-end. Most common during active development.

### Edit deploy script itself

```powershell
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM> -SkipBuild -SkipInstall
```

Faster — skips the build + npm install since you only changed PowerShell.

### Quickly cycle Appium

```powershell
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM> -RestartOnly
```

~10 seconds. Useful when changing capabilities, killing a hung session, or recovering from a crashed PowerShell sub-process (the auto-restart mechanism handles in-session crashes; `-RestartOnly` is for full Appium restart).

### Deploy to multiple VMs

```powershell
@(
    '192.168.196.128',
    '192.168.196.129',
    '192.168.196.132'
) | ForEach-Object {
    .\scripts\local\build_deploy_restart.ps1 -RemoteHost $_ -SkipInstall
}
```

## Troubleshooting

### `Cannot find module '@appium/base-driver'` on first deploy

Step 6 was skipped (you passed `-SkipInstall` on a fresh VM) or failed silently. Re-run without the flag:

```powershell
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM>     # full deploy, runs step 6
```

### `EBUSY: resource busy or locked, copyfile '…\koffi\…\koffi.node'`

A still-running Node process (typically a previous Appium instance) holds `koffi.node` open and prevents npm from updating the dependency tree. Force-kill all `node.exe`:

```powershell
ssh <user>@<vm> "powershell -Command `"taskkill /f /im node.exe /t`""
# Then retry the deploy
```

If it persists, check Task Manager on the VM directly — sometimes Windows Defender or another tool holds the file briefly.

### `Cannot process the XML from the 'Error' stream of 'C:\WINDOWS\System32\OpenSSH\ssh.exe'`

PowerShell's `$ErrorActionPreference = 'Stop'` reacts to `ssh.exe` writing CLIXML on stderr. The script's `Invoke-RemotePs` helper redirects stderr to `$null` to suppress this; if you see it, you're likely calling SSH directly outside the helper. Use the helper or `2>$null`.

### Driver loads but every command returns `PowerShell session is not available or closed`

The persistent PS session crashed (real bug or your test triggered it via `Shell.Application.Quit()` etc.). The driver's auto-restart should recover transparently from 1.1.9 onward — if it doesn't, file an issue with the appium log so the failure mode can be diagnosed.

### `Driver list shows old version but I just deployed a new one`

Step 7 ran but the install was symlinked to a stale path. Force-clean:

```powershell
ssh <user>@<vm> "powershell -Command `"appium driver uninstall novawindows2; Remove-Item -Recurse -Force C:/Users/admin/.appium/node_modules/appium-novawindows2-driver`""
.\scripts\local\build_deploy_restart.ps1 -RemoteHost <VM>     # full re-deploy
```

### Appium starts but the test can't see any UI

You're hitting Session 0. Confirm: log into the VM via Remote Desktop with the same `RemoteUser`. If you don't see a `powershell.exe` console window with title `AppiumServer`, the Scheduled Task didn't get to launch interactively. Check that the user is logged in and the Task was unregistered cleanly (it should be — the script unregisters it 8s after start).

## See also

- [Build](./build.md) — local build before deploy
- [Testing](./testing.md) — what to run after a successful deploy
- [Release process](./release-process.md) — pre-publish checklist that includes deploy verification
