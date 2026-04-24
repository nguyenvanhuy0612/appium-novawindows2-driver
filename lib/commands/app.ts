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
import { parseRectJson, sleep } from '../util';
import { errors, W3C_ELEMENT_KEY } from '@appium/base-driver';
import {
    getWindowAllHandlesForProcessIds,
    keyDown,
    keyUp,
    trySetForegroundWindow,
} from '../winapi/user32';
import { Key } from '../enums';

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
    return parseRectJson(result);
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
        await sleep((this.caps['ms:waitForAppLaunch'] as number ?? 0) * 1000 || 500);
        for (let i = 1; i <= 20; i++) {
            const result = await this.sendPowerShellCommand(/* ps1 */ `(Get-Process -Name 'ApplicationFrameHost' | Sort-Object StartTime -Descending).Id`);
            const processIds = result.split('\n').map((pid) => pid.trim()).filter(Boolean).map(Number);

            this.log.debug(`Attempt ${i}: Process IDs of ApplicationFrameHost processes: ` + processIds.join(', '));
            try {
                await this.attachToApplicationWindow(processIds, i);
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
        await sleep((this.caps['ms:waitForAppLaunch'] as number ?? 0) * 1000 || 500);
        const breadcrumbs = normalizedPath.toLowerCase().split('\\').flatMap((x) => x.split('/'));
        const executable = breadcrumbs[breadcrumbs.length - 1];
        const processName = executable.endsWith('.exe') ? executable.slice(0, executable.length - 4) : executable;
        for (let i = 1; i <= 20; i++) {
            try {
                const result = await this.sendPowerShellCommand(/* ps1 */ `(Get-Process -Name '${processName}' | Sort-Object StartTime -Descending).Id`);
                const processIds = result.split('\n').map((pid) => pid.trim()).filter(Boolean).map(Number);
                this.log.debug(`${i}: Process IDs of '${processName}' processes: ` + processIds.join(', '));

                await this.attachToApplicationWindow(processIds, i);
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

export async function attachToApplicationWindow(this: NovaWindows2Driver, processIds: number[], attemptNumber: number = 1): Promise<void> {
    const windowHandlesByPid = getWindowAllHandlesForProcessIds(processIds);
    const allHandles = Array.from(windowHandlesByPid.values()).flat();
    this.log.debug(`Attempt ${attemptNumber}: Detected the following native window handles for the given process IDs: ${allHandles.map((handle) => `0x${handle.toString(16).padStart(8, '0')}`).join(', ')}`);

    if (allHandles.length === 0) {
        throw new errors.UnknownError('Failed to locate window of the app.');
    }

    let elementId = '';
    // Iterate PIDs in order
    for (const [index, pid] of processIds.entries()) {
        // Grace period: strictly prioritize the newest process (index 0) for the first 6 attempts (approx. 3 sec).
        // This prevents attaching to an old process's window that might be present while the new process is starting.
        // If UWP app, we don't need this check because the processIds are typically just the one we found.
        if (index > 0 && attemptNumber <= 6) {
            continue;
        }

        const handles = windowHandlesByPid.get(pid);
        if (!handles || handles.length === 0) {
            continue;
        }

        for (const handle of handles) {
            const handlePadded = `0x${handle.toString(16).padStart(8, '0')}`;
            elementId = await this.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.CHILDREN, new PropertyCondition(Property.NATIVE_WINDOW_HANDLE, new PSInt32(handle))).buildCommand());

            if (elementId) {
                this.log.debug(`Attempt ${attemptNumber}: Element ID of the window from PID ${pid} with handle ${handlePadded}: ${elementId}`);

                // 1. Try SetForegroundWindow (Win32)
                if (trySetForegroundWindow(handle)) {
                    break;
                } else {
                    this.log.debug(`Attempt ${attemptNumber}: Failed to set foreground window for handle ${handlePadded}.`);
                }

                // 2. Try UIA SetFocus
                try {
                    await this.focusElement({ [W3C_ELEMENT_KEY]: elementId } satisfies Element);
                    break;
                } catch (e: any) {
                    this.log.debug(`Attempt ${attemptNumber}: Focus failed for handle ${handlePadded}: ${e.message}`);
                }
            } else {
                this.log.debug(`Attempt ${attemptNumber}: Window with handle ${handlePadded} not found in UIA yet.`);
            }
        }

        if (elementId) {
            break; // Found a valid window for a prioritized PID
        }
    }

    if (elementId) {
        this.log.debug(`Attempt ${attemptNumber}: Found element ID: ${elementId}`);
        await this.sendPowerShellCommand(/* ps1 */ `$rootElement = ${new FoundAutomationElement(elementId).buildCommand()}`);
        return;
    }

    throw new errors.UnknownError('Failed to locate window of the app.');
}

/**
 * Resolves the current root window's element ID, or throws NoSuchWindowError.
 * Used by W3C window-scoped commands (title, maximize, minimize, back, forward, close).
 */
async function getRootElementId(this: NovaWindows2Driver): Promise<string> {
    const result = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildCommand());
    const elementId = result.split('\n').map((id) => id.trim()).filter(Boolean)[0];
    if (!elementId) {
        throw new errors.NoSuchWindowError('No active window found for this session.');
    }
    return elementId;
}

export async function title(this: NovaWindows2Driver): Promise<string> {
    await getRootElementId.call(this);
    return await this.sendPowerShellCommand(
        AutomationElement.automationRoot.buildGetPropertyCommand(Property.NAME)
    );
}

export async function maximizeWindow(this: NovaWindows2Driver): Promise<void> {
    const elementId = await getRootElementId.call(this);
    try {
        await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildMaximizeCommand());
    } catch {
        throw new errors.UnknownError('Failed to maximize the window.');
    }
}

export async function minimizeWindow(this: NovaWindows2Driver): Promise<void> {
    const elementId = await getRootElementId.call(this);
    try {
        await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildMinimizeCommand());
    } catch {
        throw new errors.UnknownError('Failed to minimize the window.');
    }
}

export async function back(this: NovaWindows2Driver): Promise<void> {
    await getRootElementId.call(this);
    keyDown(Key.ALT);
    keyDown(Key.LEFT);
    keyUp(Key.LEFT);
    keyUp(Key.ALT);
}

export async function forward(this: NovaWindows2Driver): Promise<void> {
    await getRootElementId.call(this);
    keyDown(Key.ALT);
    keyDown(Key.RIGHT);
    keyUp(Key.RIGHT);
    keyUp(Key.ALT);
}

export async function closeApp(this: NovaWindows2Driver): Promise<void> {
    const elementId = await getRootElementId.call(this);
    await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildCloseCommand());
    await this.sendPowerShellCommand(/* ps1 */ `$rootElement = $null`);
}

export async function launchApp(this: NovaWindows2Driver): Promise<void> {
    if (!this.caps.app || ['root', 'none'].includes(this.caps.app.toLowerCase())) {
        throw new errors.InvalidArgumentError('No app capability is set for this session.');
    }
    await this.changeRootElement(this.caps.app);
}

export async function setWindowRect(
    this: NovaWindows2Driver,
    x: number | null,
    y: number | null,
    width: number | null,
    height: number | null
): Promise<Rect> {
    if (width !== null && width < 0) {
        throw new errors.InvalidArgumentError('width must be a non-negative integer.');
    }
    if (height !== null && height < 0) {
        throw new errors.InvalidArgumentError('height must be a non-negative integer.');
    }

    const elementId = await getRootElementId.call(this);
    const el = new FoundAutomationElement(elementId);

    if (x !== null && y !== null) {
        await this.sendPowerShellCommand(el.buildMoveCommand(x, y));
    }
    if (width !== null && height !== null) {
        await this.sendPowerShellCommand(el.buildResizeCommand(width, height));
    }

    return await this.getWindowRect();
}
