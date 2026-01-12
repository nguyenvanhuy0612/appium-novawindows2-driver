import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { NovaWindows2Driver } from '../driver';
import { errors } from '@appium/base-driver';
import { FIND_CHILDREN_RECURSIVELY, GET_LEGACY_PROPERTY_SAFE, PAGE_SOURCE } from './functions';
// import { ensureMsaaHelperCompiled, CompilationResult, getMsaaHelperCode } from '../powershell/msaa';

const SET_UTF8_ENCODING = /* ps1 */ `$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8`;
const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; Add-Type -AssemblyName UIAutomationClientsideProviders; Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName PresentationCore; Add-Type -AssemblyName System.Windows.Forms`;
const USE_UI_AUTOMATION_CLIENT = /* ps1 */ `using namespace System.Windows.Automation`;
const INIT_CACHE_REQUEST = /* ps1 */ `($cacheRequest = New-Object System.Windows.Automation.CacheRequest).TreeFilter = [AndCondition]::new([Automation]::ControlViewCondition, [NotCondition]::new([PropertyCondition]::new([AutomationElement]::FrameworkIdProperty, 'Chrome'))); $cacheRequest.Push()`;
// const INIT_CACHE_REQUEST = /* ps1 */ `
// ($cacheRequest = New-Object System.Windows.Automation.CacheRequest).TreeFilter = [AndCondition]::new([Automation]::ControlViewCondition, [NotCondition]::new([PropertyCondition]::new([AutomationElement]::FrameworkIdProperty, 'Chrome')));
// $cacheRequest.Add([AutomationElement]::NameProperty);
// $cacheRequest.Add([AutomationElement]::AutomationIdProperty);
// $cacheRequest.Add([AutomationElement]::BoundingRectangleProperty);
// $cacheRequest.Add([AutomationElement]::RuntimeIdProperty);
// $cacheRequest.Push()
// `;
const INIT_ROOT_ELEMENT = /* ps1 */ `$rootElement = [AutomationElement]::RootElement`;
const NULL_ROOT_ELEMENT = /* ps1 */ `$rootElement = $null`;
const INIT_ELEMENT_TABLE = /* ps1 */ `$elementTable = New-Object System.Collections.Generic.Dictionary[[string]\`,[AutomationElement]]`;
const DISABLE_QUICK_EDIT = /* ps1 */ `try {if (([System.Management.Automation.PSTypeName]'ConsoleHelper').Type) {[ConsoleHelper]::DisableConsoleInteractions()}} catch {}`;

export async function startPowerShellSession(this: NovaWindows2Driver): Promise<void> {
    this.log.debug(`Starting new PowerShell session...`);

    const powerShell = spawn('powershell.exe', ['-NoProfile', '-NoExit', '-Command', '-']);
    powerShell.stdout.setEncoding('utf8');
    powerShell.stderr.setEncoding('utf8');

    powerShell.stdout.on('data', (chunk: any) => {
        this.powerShellStdOut += chunk.toString();
    });

    powerShell.stderr.on('data', (chunk: any) => {
        this.powerShellStdErr += chunk.toString();
    });

    this.powerShell = powerShell;

    if (this.caps.appWorkingDir) {
        const envVarsSet: Set<string> = new Set();
        const matches = this.caps.appWorkingDir.matchAll(/%([^%]+)%/g);

        for (const match of matches) {
            envVarsSet.add(match[1]);
        }
        const envVars = Array.from(envVarsSet);
        for (const envVar of envVars) {
            this.caps.appWorkingDir = this.caps.appWorkingDir.replaceAll(`%${envVar}%`, process.env[envVar.toUpperCase()] ?? '');
        }
    }

    // const compilationResult = await ensureMsaaHelperCompiled(this.log);

    let initScript = `${USE_UI_AUTOMATION_CLIENT}\n`;
    initScript += `${SET_UTF8_ENCODING};\n`;
    initScript += `${ADD_NECESSARY_ASSEMBLIES};\n`;
    if (this.caps.appWorkingDir) {
        initScript += `Set-Location -Path '${this.caps.appWorkingDir}';\n`;
    }
    initScript += `${INIT_CACHE_REQUEST};\n`;
    initScript += `${INIT_ELEMENT_TABLE};\n`;
    // initScript += `${getMsaaHelperCode(compilationResult)};\n`;
    initScript += `${PAGE_SOURCE};\n`;
    initScript += `${GET_LEGACY_PROPERTY_SAFE};\n`;
    initScript += `${FIND_CHILDREN_RECURSIVELY};\n`;
    initScript += `${DISABLE_QUICK_EDIT};\n`;

    if ((!this.caps.app && !this.caps.appTopLevelWindow) || (!this.caps.app || this.caps.app.toLowerCase() === 'none')) {
        this.log.info(`No app or top-level window specified in capabilities. Setting root element to null.`);
        initScript += `${NULL_ROOT_ELEMENT};\n`;
    } else if (this.caps.app && this.caps.app.toLowerCase() === 'root') {
        this.log.info(`'root' specified as app in capabilities. Setting root element to desktop root.`);
        initScript += `${INIT_ROOT_ELEMENT};\n`;
    }

    await executeRawCommand(this, initScript);

    if (this.caps.app && this.caps.app.toLowerCase() !== 'none' && this.caps.app.toLowerCase() !== 'root') {
        this.log.info(`Application path specified in capabilities: ${this.caps.app}`);
        const envVarsSet: Set<string> = new Set();
        const matches = this.caps.app.matchAll(/%([^%]+)%/g);

        for (const match of matches) {
            envVarsSet.add(match[1]);
        }

        const envVars = Array.from(envVarsSet);
        this.log.info(`Detected the following environment variables in app path: ${envVars.map((envVar) => `%${envVar}%`).join(', ')}`);

        for (const envVar of envVars) {
            this.caps.app = this.caps.app.replaceAll(`%${envVar}%`, process.env[envVar.toUpperCase()] ?? '');
        }

        await this.changeRootElement(this.caps.app);
    }

    if (this.caps.appTopLevelWindow) {
        const nativeWindowHandle = Number(this.caps.appTopLevelWindow);

        if (isNaN(nativeWindowHandle)) {
            throw new errors.InvalidArgumentError(`Invalid capabilities. Capability 'appTopLevelWindow' is not a valid native window handle.`);
        }

        await this.changeRootElement(nativeWindowHandle);
    }
    this.log.debug(`PowerShell session initialization completed`);
}

export async function sendIsolatedPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    const powerShell = spawn('powershell.exe', ['-NoProfile', '-NoExit', '-Command', '-']);
    const output = { stdout: '', stderr: '' };

    try {
        powerShell.stdout.setEncoding('utf8');
        powerShell.stderr.setEncoding('utf8');

        powerShell.stdout.on('data', (chunk: any) => {
            output.stdout += chunk.toString();
        });

        powerShell.stderr.on('data', (chunk: any) => {
            output.stderr += chunk.toString();
        });

        let fullCommand = `${SET_UTF8_ENCODING}\n`;

        if (this.caps.appWorkingDir) {
            const envVarsSet: Set<string> = new Set();
            const matches = this.caps.appWorkingDir.matchAll(/%([^%]+)%/g);

            for (const match of matches) {
                envVarsSet.add(match[1]);
            }
            const envVars = Array.from(envVarsSet);
            for (const envVar of envVars) {
                this.caps.appWorkingDir = this.caps.appWorkingDir.replaceAll(`%${envVar}%`, process.env[envVar.toUpperCase()] ?? '');
            }
            fullCommand += `Set-Location -Path '${this.caps.appWorkingDir}'\n`;
        }

        fullCommand += command;

        return await executeIsolatedRawCommand(this, fullCommand, powerShell, output);
    } finally {
        // Ensure the isolated PowerShell process is terminated
        try {
            powerShell.kill();
        } catch (e) {
            this.log.warn(`Failed to terminate isolated PowerShell process: ${e}`);
        }
    }
}

export async function sendPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    const nextCommand = async () => {
        if (!this.powerShell) {
            this.log.warn('PowerShell session not running. It was either closed or has crashed. Attempting to start a new session...');
            await this.startPowerShellSession();
        }

        // Use the extracted raw command function
        return await executeRawCommand(this, command);
    };

    // Chain the command to the queue
    // Use .catch to ignore previous failures, then .then to queue this command.
    // This prevents re-running this command if it fails (no infinite loop).
    this.commandQueue = this.commandQueue
        .catch(() => { /* ignore previous error */ })
        .then(nextCommand)
        .catch((err) => {
            this.log.debug(`PowerShell command failed: ${command}\nError: ${err.message}`);
            throw err;
        });

    return this.commandQueue;
}

export async function terminatePowerShellSession(this: NovaWindows2Driver): Promise<void> {
    const terminateAction = async () => {
        if (!this.powerShell) {
            return;
        }

        if (this.powerShell.exitCode !== null) {
            this.log.debug(`PowerShell session already terminated.`);
            this.powerShell = undefined;
            return;
        }

        this.log.debug(`Terminating PowerShell session...`);
        const waitForClose = new Promise<void>((resolve) => {
            this.powerShell?.once('close', () => {
                resolve();
            });
            setTimeout(resolve, 5000); // Safety timeout
        });

        this.powerShell.kill();
        await waitForClose;
        this.powerShell = undefined;

        this.log.debug(`PowerShell session terminated successfully.`);
    };

    this.commandQueue = this.commandQueue
        .catch(() => { /* ignore */ })
        .then(terminateAction);

    return await this.commandQueue;
}

// Basic execution logic for PowerShell commands within the established session.
async function executeRawCommand(driver: NovaWindows2Driver, command: string): Promise<string> {
    const magicNumber = 0xF2EE;
    const powerShell = driver.powerShell;

    if (!powerShell || powerShell.exitCode !== null || !powerShell.stdin.writable) {
        throw new errors.UnknownError('PowerShell session is not available or closed.');
    }

    driver.powerShellStdOut = '';
    driver.powerShellStdErr = '';

    try {
        powerShell.stdin.write(`${command}\n`);
        powerShell.stdin.write(/* ps1 */ `Write-Output $([char]0x${magicNumber.toString(16)})\n`);
    } catch (e) {
        throw new errors.UnknownError(`Failed to write to PowerShell: ${e.message}`);
    }

    return await new Promise<string>((resolve, reject) => {
        const timeoutMs = (driver.caps as any).powerShellCommandTimeout || 60000;
        const timeout = setTimeout(() => {
            if (driver.powerShell === powerShell) {
                driver.log.warn(`PowerShell command timed out after ${timeoutMs}ms. Terminating process...`);
                try {
                    powerShell.kill();
                } catch (e) {
                    driver.log.warn(`Failed to kill PowerShell process: ${e}`);
                }
                driver.powerShell = undefined;
            }
            reject(new errors.TimeoutError(`PowerShell command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const onClose = (code: number) => {
            clearTimeout(timeout);
            if (driver.powerShell === powerShell) {
                driver.powerShell = undefined;
            }

            if (code === 0) {
                const result = driver.powerShellStdOut.replace(String.fromCharCode(magicNumber), '').trim();
                driver.log.debug(`PowerShell process exited gracefully (0). Result length: ${result.length}`);
                resolve(result);
            } else {
                reject(new errors.UnknownError(`PowerShell process exited unexpectedly with code ${code}`));
            }
        };
        powerShell.once('close', onClose);

        const onData = (chunk: any) => {
            const magicChar = String.fromCharCode(magicNumber);
            if (chunk.toString().includes(magicChar)) {
                clearTimeout(timeout);
                powerShell.stdout.off('data', onData);
                powerShell.off('close', onClose);
                if (driver.powerShellStdErr) {
                    driver.log.error(`PowerShell command failed: ${driver.powerShellStdErr}`);
                    reject(new errors.UnknownError(driver.powerShellStdErr));
                } else {
                    const result = driver.powerShellStdOut.replace(`${magicChar}`, '').trim();
                    driver.log.debug(`PowerShell command completed. Result length: ${result.length}`);
                    resolve(result);
                }
            }
        };

        powerShell.stdout.on('data', onData);
    });
}

async function executeIsolatedRawCommand(driver: NovaWindows2Driver, command: string, powerShell: ChildProcessWithoutNullStreams, output: { stdout: string, stderr: string }): Promise<string> {
    const magicNumber = 0xF2EE;

    powerShell.stdin.write(`${command}\n`);
    powerShell.stdin.write(/* ps1 */ `Write-Output $([char]0x${magicNumber.toString(16)})\n`);

    return await new Promise<string>((resolve, reject) => {
        const timeoutMs = (driver.caps as any).powerShellCommandTimeout || 60000;
        const timeout = setTimeout(() => {
            driver.log.warn(`Isolated PowerShell command timed out after ${timeoutMs}ms. Terminating process...`);
            try {
                powerShell.kill();
            } catch (e) {
                driver.log.warn(`Failed to kill isolated PowerShell process: ${e}`);
            }
            reject(new errors.TimeoutError(`Isolated PowerShell command timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        const onClose = (code: number) => {
            clearTimeout(timeout);
            if (code === 0) {
                const result = output.stdout.replace(String.fromCharCode(magicNumber), '').trim();
                driver.log.debug(`Isolated PowerShell process exited gracefully (0). Result length: ${result.length}`);
                resolve(result);
            } else {
                reject(new errors.UnknownError(`Isolated PowerShell process exited unexpectedly with code ${code}`));
            }
        };
        powerShell.once('close', onClose);

        const onData = (chunk: any) => {
            const magicChar = String.fromCharCode(magicNumber);
            if (chunk.toString().includes(magicChar)) {
                clearTimeout(timeout);
                powerShell.stdout.off('data', onData);
                powerShell.off('close', onClose);
                if (output.stderr) {
                    driver.log.error(`Isolated PowerShell command failed: ${output.stderr}`);
                    reject(new errors.UnknownError(output.stderr));
                } else {
                    const result = output.stdout.replace(`${magicChar}`, '').trim();
                    driver.log.debug(`Isolated PowerShell command completed. Result length: ${result.length}`);
                    resolve(result);
                }
            }
        };

        powerShell.stdout.on('data', onData);
    });
}