import { normalize } from 'node:path';
import { Element, Rect } from '@appium/types';
import { NovaWindows2Driver } from '../driver';
import {
    AutomationElement,
    FoundAutomationElement,
    PSInt32,
    PSString,
    Property,
    PropertyCondition,
    TreeScope,
    TrueCondition,
    pwsh$
} from '../powershell';
import { sleep } from '../util';
import { errors, W3C_ELEMENT_KEY } from '@appium/base-driver';
import {
    getWindowAllHandlesForProcessIds,
    trySetForegroundWindow,
} from '../winapi/user32';

const GET_PAGE_SOURCE_COMMAND = pwsh$ /* ps1 */ `
    $el = ${0};

    if ($el -eq $null) {
        $el = [AutomationElement]::RootElement;
    }

    $source = Get-PageSource $el;
    if ($null -ne $source) {
        $source.OuterXml;
    } else {
        # Final fallback if even Get-PageSource fails for some reason
        '<DummyRoot />';
    }
`;

export async function getPageSource(this: NovaWindows2Driver): Promise<string> {
    return await this.sendPowerShellCommand(GET_PAGE_SOURCE_COMMAND.format(AutomationElement.automationRoot));
}

export async function getScreenshot(this: NovaWindows2Driver): Promise<string> {
    // const automationRootId = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildCommand());

    if (this.caps.app && this.caps.app.toLowerCase() !== 'root') {
        try {
            const nativeWindowHandle = Number(await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetPropertyCommand(Property.NATIVE_WINDOW_HANDLE)));
            if (!isNaN(nativeWindowHandle) && nativeWindowHandle !== 0) {
                trySetForegroundWindow(nativeWindowHandle);
            }
        } catch {
            // noop
        }
    }

    return await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetElementScreenshotCommand());
}

export async function getWindowRect(this: NovaWindows2Driver): Promise<Rect> {
    const result = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetElementRectCommand());
    return JSON.parse(result.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString()));
}

export async function getWindowHandle(this: NovaWindows2Driver): Promise<string> {
    const nativeWindowHandle = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetPropertyCommand(Property.NATIVE_WINDOW_HANDLE));
    return `0x${Number(nativeWindowHandle).toString(16).padStart(8, '0')}`;
}

export async function getWindowHandles(this: NovaWindows2Driver): Promise<string[]> {
    const result = await this.sendPowerShellCommand(AutomationElement.rootElement.findAll(TreeScope.CHILDREN, new TrueCondition()).buildCommand());
    const elIds = result.split('\n').map((x) => x.trim()).filter(Boolean);
    const nativeWindowHandles: string[] = [];

    for (const elId of elIds) {
        const nativeWindowHandle = await this.sendPowerShellCommand(new FoundAutomationElement(elId).buildGetPropertyCommand(Property.NATIVE_WINDOW_HANDLE));
        nativeWindowHandles.push(`0x${Number(nativeWindowHandle).toString(16).padStart(8, '0')}`);
    }

    return nativeWindowHandles;
}

export async function setWindow(this: NovaWindows2Driver, nameOrHandle: string): Promise<void> {
    const handle = Number(nameOrHandle);
    for (let i = 1; i <= 20; i++) { // TODO: make a setting for the number of retries or timeout
        if (!isNaN(handle)) {
            const condition = new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSInt32(handle));
            const elementId = await this.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.CHILDREN_OR_SELF, condition).buildCommand());

            if (elementId.trim() !== '') {
                await this.sendPowerShellCommand(/* ps1 */ `$rootElement = ${new FoundAutomationElement(elementId).buildCommand()}`);
                trySetForegroundWindow(handle);
                return;
            }
        }

        const name = nameOrHandle;
        const condition = new PropertyCondition(Property.NAME, new PSString(name));
        const elementId = await this.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.CHILDREN, condition).buildCommand());

        if (elementId.trim() !== '') {
            this.log.info(`Found window with name '${name}'. Setting it as the root element.`);
            await this.sendPowerShellCommand(/* ps1 */ `$rootElement = ${new FoundAutomationElement(elementId).buildCommand()}`);
            trySetForegroundWindow(handle);
            return;
        }

        this.log.info(`Failed to locate window with name '${name}'. Sleeping for 500 milliseconds and retrying... (${i}/20)`); // TODO: make a setting for the number of retries or timeout
        await sleep(500); // TODO: make a setting for the sleep timeout
    }

    throw new errors.NoSuchWindowError(`No window was found with name or handle '${nameOrHandle}'.`);
}

export async function changeRootElement(this: NovaWindows2Driver, path: string): Promise<void>
export async function changeRootElement(this: NovaWindows2Driver, nativeWindowHandle: number): Promise<void>
export async function changeRootElement(this: NovaWindows2Driver, pathOrNativeWindowHandle: string | number): Promise<void> {
    if (typeof pathOrNativeWindowHandle === 'number') {
        const nativeWindowHandle = pathOrNativeWindowHandle;
        const condition = new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSInt32(nativeWindowHandle));
        const elementId = await this.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.CHILDREN_OR_SELF, condition).buildCommand());

        if (elementId.trim() !== '') {
            await this.sendPowerShellCommand(/* ps1 */ `$rootElement = ${new FoundAutomationElement(elementId).buildCommand()}`);
            trySetForegroundWindow(nativeWindowHandle);
            return;
        }

        throw new errors.UnknownError('Failed to locate top level window with that window handle.');
    }


    const path = pathOrNativeWindowHandle;
    if (path.includes('!') && path.includes('_') && !(path.includes('/') || path.includes('\\'))) {
        this.log.debug('Detected app path to be in the UWP format.');
        await this.sendPowerShellCommand(/* ps1 */ `Start-Process 'explorer.exe' 'shell:AppsFolder\\${path}'${this.caps.appArguments ? ` -ArgumentList '${this.caps.appArguments}'` : ''}`);
        await sleep(500); // TODO: make a setting for the initial wait time
        for (let i = 1; i <= 20; i++) {
            const result = await this.sendPowerShellCommand(/* ps1 */ `(Get-Process -Name 'ApplicationFrameHost').Id`);
            const processIds = result.split('\n').map((pid) => pid.trim()).filter(Boolean).map(Number);

            this.log.debug('Process IDs of ApplicationFrameHost processes: ' + processIds.join(', '));
            try {
                await this.attachToApplicationWindow(processIds);
                return;
            } catch {
                // noop
            }

            this.log.info(`Failed to locate window of the app. Sleeping for 500 milliseconds and retrying... (${i}/20)`); // TODO: make a setting for the number of retries or timeout
            await sleep(500); // TODO: make a setting for the sleep timeout
        }
    } else {
        this.log.debug('Detected app path to be in the classic format.');
        const normalizedPath = normalize(path);
        await this.sendPowerShellCommand(/* ps1 */ `Start-Process '${normalizedPath}'${this.caps.appArguments ? ` -ArgumentList '${this.caps.appArguments}'` : ''}`);
        await sleep(500); // TODO: make a setting for the initial wait time
        for (let i = 1; i <= 20; i++) {
            try {
                const breadcrumbs = normalizedPath.toLowerCase().split('\\').flatMap((x) => x.split('/'));
                const executable = breadcrumbs[breadcrumbs.length - 1];
                const processName = executable.endsWith('.exe') ? executable.slice(0, executable.length - 4) : executable;
                const result = await this.sendPowerShellCommand(/* ps1 */ `(Get-Process -Name '${processName}' | Sort-Object StartTime -Descending).Id`);
                const processIds = result.split('\n').map((pid) => pid.trim()).filter(Boolean).map(Number);
                this.log.debug(`Process IDs of '${processName}' processes: ` + processIds.join(', '));

                await this.attachToApplicationWindow(processIds);
                return;
            } catch (err) {
                if (err instanceof Error) {
                    this.log.debug(`Received error:\n${err.message}`);
                }
            }

            this.log.info(`Failed to locate window of the app. Sleeping for 500 milliseconds and retrying... (${i}/20)`); // TODO: make a setting for the number of retries or timeout
            await sleep(500); // TODO: make a setting for the sleep timeout
        }
    }

    throw new errors.UnknownError('Failed to locate window of the app.');
}

export async function attachToApplicationWindow(this: NovaWindows2Driver, processIds: number[]): Promise<void> {
    const nativeWindowHandles = getWindowAllHandlesForProcessIds(processIds);
    this.log.debug(`Detected the following native window handles for the given process IDs: ${nativeWindowHandles.map((handle) => `0x${handle.toString(16).padStart(8, '0')}`).join(', ')}`);

    if (nativeWindowHandles.length !== 0) {
        let elementId = '';
        let fallbackElementId = '';

        // Loop attempts to find a window that is both present and focusable
        for (let i = 1; i <= 20; i++) {
            for (let handle of nativeWindowHandles) {
                const tempElementId = await this.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.CHILDREN, new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSInt32(handle))).buildCommand());

                if (tempElementId) {
                    this.log.debug(`Element ID of the window with handle 0x${handle.toString(16).padStart(8, '0')}: ${tempElementId}`);

                    // We found an element. Check if we can interact with it.
                    // 1. Try SetForegroundWindow (Win32)
                    if (trySetForegroundWindow(handle)) {
                        elementId = tempElementId;
                        break;
                    }

                    // 2. Try UIA SetFocus
                    try {
                        await this.focusElement({ [W3C_ELEMENT_KEY]: tempElementId } satisfies Element);
                        elementId = tempElementId;
                        break;
                    } catch (e: any) {
                        this.log.debug(`Focus failed for handle 0x${handle.toString(16).padStart(8, '0')}: ${e.message}`);
                        // Store as fallback if we haven't found one yet
                        if (!fallbackElementId) {
                            fallbackElementId = tempElementId;
                        }
                    }
                } else {
                    this.log.debug(`Window with handle 0x${handle.toString(16).padStart(8, '0')} not found in UIA yet.`);
                }
            }

            if (elementId) {
                break;
            }

            this.log.info(`No suitable application window found yet. Sleeping for 500 milliseconds and retrying... (${i}/20)`);
            await sleep(500);
        }

        // If no focusable window found, but we have a fallback (unfocusable window), use it.
        if (!elementId && fallbackElementId) {
            this.log.info(`Could not focus any application window. Attaching to the first found window (Fallback) using element ID: ${fallbackElementId}`);
            elementId = fallbackElementId;
        }

        if (elementId) {
            await this.sendPowerShellCommand(/* ps1 */ `$rootElement = ${new FoundAutomationElement(elementId).buildCommand()}`);
            return;
        }
    }
}
