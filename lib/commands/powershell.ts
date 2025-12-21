import { spawn } from 'node:child_process';
import { NovaWindows2Driver } from '../driver';
import { errors } from '@appium/base-driver';
import { FIND_CHILDREN_RECURSIVELY, PAGE_SOURCE } from './functions';
import { ChildProcessWithoutNullStreams } from 'node:child_process';

const SET_UTF8_ENCODING = /* ps1 */ `$OutputEncoding = [Console]::OutputEncoding = [Text.Encoding]::UTF8`;
const ADD_NECESSARY_ASSEMBLIES = /* ps1 */ `Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName System.Drawing; Add-Type -AssemblyName PresentationCore; Add-Type -AssemblyName System.Windows.Forms`;
const USE_UI_AUTOMATION_CLIENT = /* ps1 */ `using namespace System.Windows.Automation`;
const INIT_CACHE_REQUEST = /* ps1 */ `($cacheRequest = New-Object System.Windows.Automation.CacheRequest).TreeFilter = [AndCondition]::new([Automation]::ControlViewCondition, [NotCondition]::new([PropertyCondition]::new([AutomationElement]::FrameworkIdProperty, 'Chrome'))); $cacheRequest.Push()`;
const INIT_ROOT_ELEMENT = /* ps1 */ `$rootElement = [AutomationElement]::RootElement`;
const NULL_ROOT_ELEMENT = /* ps1 */ `$rootElement = $null`;
const INIT_ELEMENT_TABLE = /* ps1 */ `$elementTable = New-Object System.Collections.Generic.Dictionary[[string]\`,[AutomationElement]]`;

async function executeRawCommand(driver: NovaWindows2Driver, command: string): Promise<string> {
    const magicNumber = 0xF2EE;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const powerShell = driver.powerShell!;

    driver.powerShellStdOut = '';
    driver.powerShellStdErr = '';

    powerShell.stdin.write(`${command}\n`);
    powerShell.stdin.write(/* ps1 */ `Write-Output $([char]0x${magicNumber.toString(16)})\n`);

    return await new Promise<string>((resolve, reject) => {
        const onClose = (code: number) => {
            reject(new errors.UnknownError(`PowerShell process exited unexpectedly with code ${code}`));
            driver.powerShell = undefined; // Clear the reference as the process is dead
        };
        powerShell.on('close', onClose);

        const onData: Parameters<typeof powerShell.stdout.on>[1] = ((chunk: any) => {
            const magicChar = String.fromCharCode(magicNumber);
            if (chunk.toString().includes(magicChar)) {
                powerShell.stdout.off('data', onData);
                powerShell.off('close', onClose);
                if (driver.powerShellStdErr) {
                    reject(new errors.UnknownError(driver.powerShellStdErr));
                } else {
                    resolve(driver.powerShellStdOut.replace(`${magicChar}`, '').trim());
                }
            }
        }).bind(driver);

        powerShell.stdout.on('data', onData);
    });
}

async function executeIsolatedRawCommand(driver: NovaWindows2Driver, command: string, powerShell: ChildProcessWithoutNullStreams): Promise<string> {
    const magicNumber = 0xF2EE;

    driver.powerShellStdOut = '';
    driver.powerShellStdErr = '';

    powerShell.stdin.write(`${command}\n`);
    powerShell.stdin.write(/* ps1 */ `Write-Output $([char]0x${magicNumber.toString(16)})\n`);

    return await new Promise<string>((resolve, reject) => {
        const onClose = (code: number) => {
            reject(new errors.UnknownError(`PowerShell process exited unexpectedly with code ${code}`));
        };
        powerShell.on('close', onClose);

        const onData: Parameters<typeof powerShell.stdout.on>[1] = ((chunk: any) => {
            const magicChar = String.fromCharCode(magicNumber);
            if (chunk.toString().includes(magicChar)) {
                powerShell.stdout.off('data', onData);
                powerShell.off('close', onClose);
                if (driver.powerShellStdErr) {
                    reject(new errors.UnknownError(driver.powerShellStdErr));
                } else {
                    resolve(driver.powerShellStdOut.replace(`${magicChar}`, '').trim());
                }
            }
        }).bind(driver);

        powerShell.stdout.on('data', onData);
    });
}

export async function startPowerShellSession(this: NovaWindows2Driver): Promise<void> {
    this.log.debug('Starting new PowerShell session...');
    const powerShell = spawn('powershell.exe', ['-NoExit', '-Command', '-']);
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
        // Use raw execution to bypass queue
        await executeRawCommand(this, `Set-Location -Path '${this.caps.appWorkingDir}'`);
    }

    // Use raw execution to bypass queue
    await executeRawCommand(this, SET_UTF8_ENCODING);
    await executeRawCommand(this, ADD_NECESSARY_ASSEMBLIES);
    await executeRawCommand(this, USE_UI_AUTOMATION_CLIENT);
    await executeRawCommand(this, INIT_CACHE_REQUEST);
    await executeRawCommand(this, INIT_ELEMENT_TABLE);

    // initialize functions
    await executeRawCommand(this, PAGE_SOURCE);
    await executeRawCommand(this, FIND_CHILDREN_RECURSIVELY);

    if ((!this.caps.app && !this.caps.appTopLevelWindow) || (!this.caps.app || this.caps.app.toLowerCase() === 'none')) {
        this.log.info(`No app or top-level window specified in capabilities. Setting root element to null.`);
        await executeRawCommand(this, NULL_ROOT_ELEMENT);
    }

    if (this.caps.app && this.caps.app.toLowerCase() === 'root') {
        this.log.info(`'root' specified as app in capabilities. Setting root element to desktop root.`);
        await executeRawCommand(this, INIT_ROOT_ELEMENT);
    }

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
}

export async function sendIsolatedPowerShellCommand(this: NovaWindows2Driver, command: string): Promise<string> {
    const powerShell = spawn('powershell.exe', ['-NoExit', '-Command', '-']);
    try {
        powerShell.stdout.setEncoding('utf8');
        powerShell.stderr.setEncoding('utf8');

        powerShell.stdout.on('data', (chunk: any) => {
            this.powerShellStdOut += chunk.toString();
        });

        powerShell.stderr.on('data', (chunk: any) => {
            this.powerShellStdErr += chunk.toString();
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

        return await executeIsolatedRawCommand(this, fullCommand, powerShell);
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
        .then(nextCommand);

    return this.commandQueue;
}

export async function terminatePowerShellSession(this: NovaWindows2Driver): Promise<void> {
    if (!this.powerShell) {
        return;
    }

    if (this.powerShell.exitCode !== null) {
        this.log.debug(`PowerShell session already terminated.`);
        return;
    }

    this.log.debug(`Terminating PowerShell session...`);
    const waitForClose = new Promise<void>((resolve, reject) => {
        if (!this.powerShell) {
            resolve();
        }

        this.powerShell?.once('close', () => {
            resolve();
        });

        this.powerShell?.once('error', (err: Error) => {
            reject(err);
        });
    });


    this.powerShell.kill();
    await waitForClose;
    this.log.debug(`PowerShell session terminated successfully.`);
}
