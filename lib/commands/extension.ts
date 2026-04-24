import { W3C_ELEMENT_KEY, errors } from '@appium/base-driver';
import { Element, Rect } from '@appium/types';
import { NovaWindows2Driver } from '../driver';
import { $, parseRectJson, sleep } from '../util';
import { POWER_SHELL_FEATURE } from '../constants';
import {
    keyDown,
    keyUp,
    mouseDown,
    mouseMoveAbsolute,
    mouseScroll,
    mouseUp,
    sendKeyboardEvents,
    findWindowHandle,
    showWindow,
    trySetForegroundWindow,
    getCursorPosition
} from '../winapi/user32';
import { KeyEventFlags, VirtualKey } from '../winapi/types';
import {
    AutomationElement,
    AutomationElementMode,
    FoundAutomationElement,
    PSInt32Array,
    Property,
    PropertyCondition,
    PropertyRegexMatcher,
    TreeScope,
    convertStringToCondition,
    TrueCondition,
    pwsh
} from '../powershell';
import { ClickType, Enum, Key } from '../enums';

const PLATFORM_COMMAND_PREFIX = 'windows:';

const EXTENSION_COMMANDS = Object.freeze({
    cacheRequest: 'pushCacheRequest',
    invoke: 'patternInvoke',
    expand: 'patternExpand',
    collapse: 'patternCollapse',
    isMultiple: 'patternIsMultiple',
    scrollIntoView: 'patternScrollIntoView',
    selectedItem: 'patternGetSelectedItem',
    allSelectedItems: 'patternGetAllSelectedItems',
    addToSelection: 'patternAddToSelection',
    removeFromSelection: 'patternRemoveFromSelection',
    select: 'patternSelect',
    toggle: 'patternToggle',
    setValue: 'patternSetValue',
    getValue: 'patternGetValue',
    maximize: 'patternMaximize',
    minimize: 'patternMinimize',
    restore: 'patternRestore',
    close: 'patternClose',
    keys: 'executeKeys',
    click: 'executeClick',
    hover: 'executeHover',
    scroll: 'executeScroll',
    setFocus: 'focusElement',
    getClipboard: 'getClipboardBase64',
    setClipboard: 'setClipboardFromBase64',
    setProcessForeground: 'activateProcess',
    getAttributes: 'getAttributes',
    typeDelay: 'typeDelay',
    clickAndDrag: 'executeClickAndDrag',
    startRecordingScreen: 'startRecordingScreen',
    stopRecordingScreen: 'stopRecordingScreen',
    launchApp: 'launchApp',
    closeApp: 'closeApp',
} as const);

const ContentType = Object.freeze({
    PLAINTEXT: 'plaintext',
    IMAGE: 'image',
} as const);

type ContentType = Enum<typeof ContentType>;

const TREE_FILTER_COMMAND = $ /* ps1 */ `$cacheRequest.Pop(); $cacheRequest.TreeFilter = ${0}; $cacheRequest.Push()`;
const TREE_SCOPE_COMMAND = $ /* ps1 */ `$cacheRequest.Pop(); $cacheRequest.TreeScope = ${0}; $cacheRequest.Push()`;
const AUTOMATION_ELEMENT_MODE = $ /* ps1 */ `$cacheRequest.Pop(); $cacheRequest.AutomationElementMode = ${0}; $cacheRequest.Push()`;

const SET_PLAINTEXT_CLIPBOARD_FROM_BASE64 = $ /* ps1 */ `Set-Clipboard -Value ([System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${0}')))`;
const GET_PLAINTEXT_CLIPBOARD_BASE64 = /* ps1 */ `[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Clipboard)))`;

const SET_IMAGE_CLIPBOARD_FROM_BASE64 = $ /* ps1 */ `$b = [Convert]::FromBase64String('${0}'); $s = New-Object IO.MemoryStream; $s.Write($b, 0, $b.Length); $s.Position = 0; $i = [System.Windows.Media.Imaging.BitmapFrame]::Create($s); [Windows.Clipboard]::SetImage($i); $s.Close()`;
const GET_IMAGE_CLIPBOARD_BASE64 = pwsh /* ps1 */ `
    [Windows.Clipboard]::GetImage() | ForEach-Object {
        if ($_ -ne $null) {
            $stream = New-Object IO.MemoryStream;
            $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder;
            $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($_));
            $encoder.Save($stream);
            $stream.Position = 0;
            $bytes = $stream.ToArray();
            $base64String = [Convert]::ToBase64String($bytes);
            $stream.Close();
            Write-Output $base64String;
        }
    }
`;

type KeyAction = {
    pause?: number,
    text?: string,
    virtualKeyCode?: number,
    down?: boolean,
}

export type ModifierKeyName = 'shift' | 'ctrl' | 'alt' | 'win';
const MODIFIER_KEY_MAP: Record<ModifierKeyName, string> = {
    ctrl: Key.CONTROL,
    alt: Key.ALT,
    shift: Key.SHIFT,
    win: Key.META,
};

const CLICK_TYPE_BUTTON_MAP: Record<ClickType, number> = {
    [ClickType.LEFT]: 0,
    [ClickType.MIDDLE]: 1,
    [ClickType.RIGHT]: 2,
    [ClickType.BACK]: 3,
    [ClickType.FORWARD]: 4,
};

/**
 * Resolve an element id against the current PS session's element table.
 * If the id isn't cached, look it up via RUNTIME_ID in the root subtree.
 * Throws NoSuchElementError if the lookup fails.
 *
 * Shared by executeClick / executeHover / executeScroll / executeClickAndDrag
 * (6 previously-duplicated call sites).
 */
async function ensureElementResolved(
    driver: NovaWindows2Driver,
    elementId: string,
): Promise<void> {
    const isNull = await driver.sendPowerShellCommand(
        /* ps1 */ `$null -eq ${new FoundAutomationElement(elementId).toString()}`
    );
    if (isNull.toLowerCase() !== 'true') {
        return;
    }
    const condition = new PropertyCondition(
        Property.RUNTIME_ID,
        new PSInt32Array(elementId.split('.').map(Number)),
    );
    const resolved = await driver.sendPowerShellCommand(
        AutomationElement.automationRoot.findFirst(TreeScope.SUBTREE, condition).buildCommand()
    );
    if (resolved.trim() === '') {
        throw new errors.NoSuchElementError();
    }
}

/**
 * Run `fn` with the listed modifier keys held down, then release them.
 * Release happens in a `finally` block so a thrown `fn` can't leak modifier
 * state into the next command. Duplicates are deduplicated; unknown names
 * are ignored (matches the permissive behavior of the original code).
 */
async function withModifierKeys<T>(
    modifierKeys: ModifierKeyName | ModifierKeyName[] | undefined,
    fn: () => Promise<T> | T,
): Promise<T> {
    const rawKeys = modifierKeys == null
        ? []
        : (Array.isArray(modifierKeys) ? modifierKeys : [modifierKeys]);
    const pressed: string[] = [];
    for (const raw of rawKeys) {
        if (!raw) continue;
        const mapped = MODIFIER_KEY_MAP[raw.toLowerCase() as ModifierKeyName];
        if (mapped && !pressed.includes(mapped)) {
            keyDown(mapped);
            pressed.push(mapped);
        }
    }
    try {
        return await fn();
    } finally {
        // Release in reverse order, and swallow per-key release errors so
        // one failure doesn't mask the original fn error.
        for (let i = pressed.length - 1; i >= 0; i--) {
            try { keyUp(pressed[i]); } catch { /* noop */ }
        }
    }
}

export async function execute(this: NovaWindows2Driver, script: string, args: any[]) {
    if (script.startsWith(PLATFORM_COMMAND_PREFIX)) {
        script = script.replace(PLATFORM_COMMAND_PREFIX, '').trim();
        this.log.info(`Executing command '${PLATFORM_COMMAND_PREFIX} ${script}'...`);

        if (!Object.hasOwn(EXTENSION_COMMANDS, script)) {
            throw new errors.UnknownCommandError(`Unknown command '${PLATFORM_COMMAND_PREFIX} ${script}'.`);
        }

        return await this[EXTENSION_COMMANDS[script]](...args);
    }

    if (script.toLowerCase() === 'powershell') {
        this.assertFeatureEnabled(POWER_SHELL_FEATURE);
        const args0 = args[0] || {};
        return await this.executePowerShellScript(args0);
    }

    if (script === 'return window.name') {
        return await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetPropertyCommand(Property.NAME));
    }

    if (script === 'pullFile') {
        const { path } = args[0];
        return await this.pullFile(path);
    }

    if (script === 'pushFile') {
        const { path, data } = args[0];
        return await this.pushFile(path, data);
    }

    if (script === 'pullFolder') {
        const { path } = args[0];
        return await this.pullFolder(path);
    }

    if (script === 'arguments[0].scrollIntoView()') {
        const element = args[0];
        if (!element || typeof element !== 'object') {
            throw new errors.InvalidArgumentError('First argument must be an element object.');
        }
        return await this.patternScrollIntoView(element);
    }

    throw new errors.NotImplementedError();
};

type CacheRequest = {
    treeScope?: string,
    treeFilter?: string,
    automationElementMode?: string,
}

const TREE_SCOPE_REGEX = new PropertyRegexMatcher('System.Windows.Automation.TreeScope', ...Object.values(TreeScope)).toRegex('i');
const AUTOMATION_ELEMENT_MODE_REGEX = new PropertyRegexMatcher('System.Windows.Automation.AutomationElementMode', ...Object.values(AutomationElementMode)).toRegex('i');

export async function pushCacheRequest(this: NovaWindows2Driver, cacheRequest: CacheRequest): Promise<void> {
    if (Object.keys(cacheRequest).every((key) => cacheRequest[key] === undefined)) {
        throw new errors.InvalidArgumentError('At least one property of the cache request must be set.');
    }

    if (cacheRequest.treeFilter) {
        let condition;
        try {
            condition = convertStringToCondition(cacheRequest.treeFilter);
        } catch (e: any) {
            // convertStringToCondition throws an InvalidSelectorError subclass.
            // Rethrow as InvalidArgumentError for consistency with the sibling
            // validations on treeScope / automationElementMode.
            throw new errors.InvalidArgumentError(
                `Invalid treeFilter '${cacheRequest.treeFilter}' for cache request: ${e?.message ?? e}`
            );
        }
        await this.sendPowerShellCommand(TREE_FILTER_COMMAND.format(condition));
    }

    if (cacheRequest.treeScope) {
        // Accept either a known TreeScope name (case-insensitive) or a
        // numeric bitflag in 1..16. The regex match exposes its capture at
        // index [1]; .groups is undefined when there are no named captures.
        const matchedName = TREE_SCOPE_REGEX.exec(cacheRequest.treeScope)?.[1];
        const n = Number(cacheRequest.treeScope);
        const validNumber = !isNaN(n) && n >= 1 && n <= 16;
        if (!matchedName && !validNumber) {
            throw new errors.InvalidArgumentError(`Invalid value '${cacheRequest.treeScope}' passed to TreeScope for cache request.`);
        }

        await this.sendPowerShellCommand(TREE_SCOPE_COMMAND.format(isNaN(n) ? /* ps1 */ `[TreeScope]::${cacheRequest.treeScope}` : cacheRequest.treeScope));
    }

    if (cacheRequest.automationElementMode) {
        const matchedName = AUTOMATION_ELEMENT_MODE_REGEX.exec(cacheRequest.automationElementMode)?.[1];
        const n = Number(cacheRequest.automationElementMode);
        const validNumber = !isNaN(n) && n >= 0 && n <= 1;
        if (!matchedName && !validNumber) {
            throw new errors.InvalidArgumentError(`Invalid value '${cacheRequest.automationElementMode}' passed to AutomationElementMode for cache request.`);
        }

        let automationElementMode: string;
        if (isNaN(n)) {
            automationElementMode = /* ps1 */ `[AutomationElementMode]::${cacheRequest.automationElementMode}`;
        } else {
            automationElementMode = cacheRequest.automationElementMode;
        }

        await this.sendPowerShellCommand(AUTOMATION_ELEMENT_MODE.format(automationElementMode));
    }
}

export async function patternInvoke(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildInvokeCommand());
}

export async function patternExpand(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildExpandCommand());
}

export async function patternCollapse(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildCollapseCommand());
}

export async function patternScrollIntoView(this: NovaWindows2Driver, element: Element): Promise<void> {
    const elementId = element?.[W3C_ELEMENT_KEY];
    if (!elementId) {
        throw new errors.InvalidArgumentError('Element ID is required for scrollIntoView.');
    }

    const automationElement = new FoundAutomationElement(elementId);

    try {
        await this.sendPowerShellCommand(automationElement.buildScrollIntoViewCommand());
    } catch (e: any) {
        this.log.warn(`Standard scrollIntoView failed: ${e.message}. Attempting keyboard fallback for element ${elementId}.`);
        await this.scrollWithKeyboard(automationElement);
    }
}

export async function scrollWithKeyboard(this: NovaWindows2Driver, automationElement: AutomationElement): Promise<void> {
    try {
        // Fallback: Focus parent and arrow down
        const parentId = await this.sendPowerShellCommand(automationElement.findFirst(TreeScope.PARENT, new TrueCondition()).buildCommand());
        if (parentId) {
            await this.sendPowerShellCommand(new FoundAutomationElement(parentId.trim()).buildSetFocusCommand());

            const maxRetries = 20;
            for (let i = 0; i < maxRetries; i++) {
                const isOffscreen = await this.sendPowerShellCommand(automationElement.buildGetPropertyCommand(Property.IS_OFFSCREEN));
                if (isOffscreen.toLowerCase() === 'false') {
                    return;
                }

                await this.handleKeyActionSequence({
                    type: 'key',
                    id: 'default keyboard',
                    actions: [{ type: 'keyDown', value: Key.PAGE_DOWN }, { type: 'keyUp', value: Key.PAGE_DOWN }]
                });

                await sleep(200);
            }

            // Final check
            const isOffscreen = await this.sendPowerShellCommand(automationElement.buildGetPropertyCommand(Property.IS_OFFSCREEN));
            if (isOffscreen.toLowerCase() === 'true') {
                throw new Error(`Element still offscreen after ${maxRetries} PageDown presses.`);
            }
        } else {
            throw new Error('Could not find parent element to focus.');
        }
    } catch (fallbackError: any) {
        throw new Error(`ScrollIntoView failed. Fallback: ${fallbackError.message}`);
    }
}

export async function patternIsMultiple(this: NovaWindows2Driver, element: Element): Promise<boolean> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildIsMultipleSelectCommand());
    return result.toLowerCase() === 'true';
}

export async function patternGetSelectedItem(this: NovaWindows2Driver, element: Element): Promise<Element> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildGetSelectionCommand());
    const elId = result.split('\n').filter(Boolean)[0];

    if (!elId) {
        throw new errors.NoSuchElementError();
    }

    return { [W3C_ELEMENT_KEY]: elId };
}

export async function patternGetAllSelectedItems(this: NovaWindows2Driver, element: Element): Promise<Element[]> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildGetSelectionCommand());
    return result.split('\n').filter(Boolean).map((elId) => ({ [W3C_ELEMENT_KEY]: elId }));
}

export async function patternAddToSelection(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildAddToSelectionCommand());
}

export async function patternRemoveFromSelection(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildRemoveFromSelectionCommand());
}

export async function patternSelect(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildSelectCommand());
}

export async function patternToggle(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildToggleCommand());
}

export async function patternSetValue(this: NovaWindows2Driver, element: Element, value: string): Promise<void> {
    const el = new FoundAutomationElement(element[W3C_ELEMENT_KEY]);
    try {
        await this.sendPowerShellCommand(el.buildSetValueCommand(value));
    } catch (valueErr: any) {
        // ValuePattern failed — log the original error for diagnostics,
        // then try the RangeValuePattern fallback (useful for sliders etc).
        this.log.debug(`[patternSetValue] ValuePattern failed, trying RangeValuePattern. Original: ${valueErr?.message}`);
        try {
            await this.sendPowerShellCommand(el.buildSetRangeValueCommand(value));
        } catch (rangeErr: any) {
            // Both patterns failed. Preserve both error messages so the user
            // can tell whether the element supports neither pattern, the value
            // is malformed, etc.
            throw new errors.UnknownError(
                `Failed to set value on element. ValuePattern error: ${valueErr?.message ?? valueErr}. ` +
                `RangeValuePattern fallback error: ${rangeErr?.message ?? rangeErr}.`
            );
        }
    }
}

export async function patternGetValue(this: NovaWindows2Driver, element: Element): Promise<string> {
    return await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildGetValueCommand());
}

export async function patternMaximize(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildMaximizeCommand());
}

export async function patternMinimize(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildMinimizeCommand());
}

export async function patternRestore(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildRestoreCommand());
}

export async function patternClose(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildCloseCommand());
}

export async function focusElement(this: NovaWindows2Driver, element: Element): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(element[W3C_ELEMENT_KEY]).buildSetFocusCommand());
}

export async function getClipboardBase64(this: NovaWindows2Driver, contentType?: ContentType | { contentType?: ContentType }): Promise<string> {
    if (!contentType || (contentType && typeof contentType === 'object')) {
        contentType = contentType?.contentType ?? ContentType.PLAINTEXT;
    }

    switch (contentType.toLowerCase()) {
        case ContentType.PLAINTEXT:
            return await this.sendPowerShellCommand(GET_PLAINTEXT_CLIPBOARD_BASE64);
        case ContentType.IMAGE:
            return await this.sendPowerShellCommand(GET_IMAGE_CLIPBOARD_BASE64);
        default:
            throw new errors.InvalidArgumentError(`Unsupported content type '${contentType}'.`);
    }
}

export async function setClipboardFromBase64(this: NovaWindows2Driver, args: { contentType?: ContentType, b64Content: string }): Promise<string> {
    if (!args || typeof args !== 'object' || !args.b64Content) {
        throw new errors.InvalidArgumentError(`'b64Content' must be provided.`);
    }

    const contentType = args.contentType ?? ContentType.PLAINTEXT;

    switch (contentType.toLowerCase()) {
        case ContentType.PLAINTEXT:
            return await this.sendPowerShellCommand(SET_PLAINTEXT_CLIPBOARD_FROM_BASE64.format(args.b64Content));
        case ContentType.IMAGE:
            return await this.sendPowerShellCommand(SET_IMAGE_CLIPBOARD_FROM_BASE64.format(args.b64Content));
        default:
            throw new errors.InvalidArgumentError(`Unsupported content type '${contentType}'.`);
    }
}

export async function executePowerShellScript(this: NovaWindows2Driver, script: string | { script: string, command: undefined } | { script: undefined, command: string }): Promise<string> {
    if (script && typeof script === 'object') {
        if (script.script) {
            script = script.script;
        } else if (script.command) {
            script = script.command;
        } else {
            throw new errors.InvalidArgumentError('Either script or command must be provided.');
        }
    }

    const scriptToExecute = pwsh`${script}`;
    if (this.caps.isolatedScriptExecution) {
        return await this.sendIsolatedPowerShellCommand(scriptToExecute);
    } else {
        return await this.sendPowerShellCommand(scriptToExecute);
    }
}

export async function executeKeys(this: NovaWindows2Driver, keyActions: { actions: KeyAction | KeyAction[], forceUnicode: boolean }) {
    if (!Array.isArray(keyActions.actions)) {
        keyActions.actions = [keyActions.actions];
    }

    keyActions.forceUnicode ??= false;

    for (const action of keyActions.actions) {
        if (Number(!!action.pause) + Number(!!action.text) + Number(!!action.virtualKeyCode) !== 1) {
            throw new errors.InvalidArgumentError('Either pause, text or virtualKeyCode should be set.');
        }

        if (action.pause) {
            await sleep(action.pause);
            continue;
        }

        if (action.virtualKeyCode) {
            if (action.down === undefined) {
                sendKeyboardEvents([{
                    wVk: action.virtualKeyCode as VirtualKey,
                    wScan: 0,
                    dwFlags: 0,
                    time: 0,
                    dwExtraInfo: 0,
                }, {
                    wVk: action.virtualKeyCode as VirtualKey,
                    wScan: 0,
                    dwFlags: KeyEventFlags.KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                }]);
            } else {
                sendKeyboardEvents([{
                    wVk: action.virtualKeyCode as VirtualKey,
                    wScan: 0,
                    dwFlags: action.down ? 0 : KeyEventFlags.KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                }]);
            }
            continue;
        }

        for (const key of action.text ?? []) {
            if (action.down !== undefined) {
                if (action.down) {
                    keyDown(key, keyActions.forceUnicode);
                } else {
                    keyUp(key, keyActions.forceUnicode);
                }
            } else {
                keyDown(key, keyActions.forceUnicode);
                keyUp(key, keyActions.forceUnicode);
            }
        }
    }
}

export async function executeClick(this: NovaWindows2Driver, clickArgs: {
    elementId?: string,
    x?: number,
    y?: number,
    button?: ClickType,
    modifierKeys?: ModifierKeyName | ModifierKeyName[],
    durationMs?: number,
    times?: number,
    interClickDelayMs?: number
} = {}) {
    const {
        elementId,
        x, y,
        button = ClickType.LEFT,
        modifierKeys = [],
        durationMs = 0,
        times = 1,
        interClickDelayMs = 100,
    } = clickArgs;

    if (!elementId && (x == null || y == null)) {
        if (x != null || y != null) {
            throw new errors.InvalidArgumentError('Both x and y must be provided if one is provided.');
        } else {
            this.log.info('No coordinates or element provided. Using current cursor position for click.');
        }
    }

    let pos: [number, number];
    if (elementId) {
        await ensureElementResolved(this, elementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        // Calculate absolute position. Default to center of element if x/y are not provided.
        pos = [
            rect.x + (x ?? Math.trunc(rect.width / 2)),
            rect.y + (y ?? Math.trunc(rect.height / 2)),
        ];
    } else if (x != null && y != null) {
        pos = [x, y];
    } else {
        pos = getCursorPosition();
    }

    const mouseButton = CLICK_TYPE_BUTTON_MAP[button];

    await mouseMoveAbsolute(pos[0], pos[1], 0);
    for (let i = 0; i < times; i++) {
        if (i !== 0) {
            await sleep(interClickDelayMs);
        }

        await withModifierKeys(modifierKeys, async () => {
            mouseDown(mouseButton);
            try {
                if (durationMs > 0) {
                    await sleep(durationMs);
                }
            } finally {
                mouseUp(mouseButton);
            }
        });
    }

    if (this.caps.delayAfterClick) {
        await sleep(this.caps.delayAfterClick ?? 0);
    }
}

export async function executeHover(this: NovaWindows2Driver, hoverArgs: {
    startElementId?: string,
    startX?: number,
    startY?: number,
    endElementId?: string,
    endX?: number,
    endY?: number,
    modifierKeys?: ModifierKeyName | ModifierKeyName[],
    durationMs?: number,
} = {}) {
    const {
        startElementId,
        startX, startY,
        endElementId,
        endX, endY,
        modifierKeys = [],
        durationMs = 500,
    } = hoverArgs;

    if (!startElementId && (startX == null || startY == null)) {
        if (startX != null || startY != null) {
            throw new errors.InvalidArgumentError('Both startX and startY must be provided if one is provided.');
        } else {
            this.log.info('No start coordinates or element provided. Using current cursor position for hover start.');
        }
    }

    let startPos: [number, number];
    if (startElementId) {
        await ensureElementResolved(this, startElementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(startElementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        // Calculate absolute start position. Default to center of element if startX/startY are not provided.
        startPos = [
            rect.x + (startX ?? Math.trunc(rect.width / 2)),
            rect.y + (startY ?? Math.trunc(rect.height / 2))
        ];
    } else if (startX != null && startY != null) {
        startPos = [startX, startY];
    } else {
        startPos = getCursorPosition();
    }

    const hasEndTarget = endElementId || (endX != null && endY != null);
    let endPos: [number, number] | undefined;
    if (endElementId) {
        await ensureElementResolved(this, endElementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(endElementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        // Calculate absolute end position. Default to center of element if endX/endY are not provided.
        endPos = [
            rect.x + (endX ?? Math.trunc(rect.width / 2)),
            rect.y + (endY ?? Math.trunc(rect.height / 2))
        ];
    } else if (endX != null && endY != null) {
        endPos = [endX, endY];
    }

    if (hasEndTarget) {
        // Legacy multi-point hover: jump to start position first (without modifiers)
        await mouseMoveAbsolute(startPos[0], startPos[1], 0);
    }

    await withModifierKeys(modifierKeys, async () => {
        if (hasEndTarget) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await mouseMoveAbsolute(endPos![0], endPos![1], durationMs, this.caps.smoothPointerMove);
        } else {
            // Single-point hover: move smoothly from current position to start
            await mouseMoveAbsolute(startPos[0], startPos[1], durationMs, this.caps.smoothPointerMove);
        }
    });
}

export async function executeScroll(this: NovaWindows2Driver, scrollArgs: {
    elementId?: string,
    x?: number,
    y?: number,
    deltaX?: number,
    deltaY?: number,
    modifierKeys?: ModifierKeyName | ModifierKeyName[],
} = {}) {
    const {
        elementId,
        x, y,
        deltaX, deltaY,
        modifierKeys = [],
    } = scrollArgs;

    if (!elementId && (x == null || y == null)) {
        if (x != null || y != null) {
            throw new errors.InvalidArgumentError('Both x and y must be provided if one is provided.');
        } else {
            this.log.info('No coordinates or element provided. Using current cursor position for scroll.');
        }
    }

    let pos: [number, number];
    if (elementId) {
        await ensureElementResolved(this, elementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        // Calculate absolute position. Default to center of element if x/y are not provided.
        pos = [
            rect.x + (x ?? Math.trunc(rect.width / 2)),
            rect.y + (y ?? Math.trunc(rect.height / 2)),
        ];
    } else if (x != null && y != null) {
        pos = [x, y];
    } else {
        pos = getCursorPosition();
    }

    await mouseMoveAbsolute(pos[0], pos[1], 0);
    await withModifierKeys(modifierKeys, () => {
        mouseScroll(deltaX ?? 0, deltaY ?? 0);
    });
}

export async function activateProcess(this: NovaWindows2Driver, args: { process: string }) {
    if (!args || typeof args !== 'object' || !args.process) {
        throw new errors.InvalidArgumentError(`'process' must be provided.`);
    }

    const hwnd = findWindowHandle(args.process);
    if (hwnd) {
        showWindow(hwnd, 9); // SW_RESTORE
        trySetForegroundWindow(hwnd);
    } else {
        throw new errors.NoSuchElementError(`Could not find a window for process '${args.process}'`);
    }
}

export async function getAttributes(this: NovaWindows2Driver, arg: any): Promise<string> {
    const elementId = arg?.[W3C_ELEMENT_KEY] || arg?.elementId || (typeof arg === 'string' ? arg : undefined);
    if (!elementId) {
        throw new errors.InvalidArgumentError('Element ID is required. Pass either an element object or an object with "elementId" property.');
    }
    return await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetAllPropertiesCommand());
}

export async function typeDelay(this: NovaWindows2Driver, args: { delay: number | string } | string | number | undefined) {
    let delay: number;
    if (typeof args === 'object' && args !== null && 'delay' in args) {
        delay = Number(args.delay);
    } else if (typeof args === 'string') {
        delay = Number(args);
    } else if (typeof args === 'number') {
        delay = args;
    } else {
        throw new errors.InvalidArgumentError('Delay must be provided as an object { delay: number } or a number/string.');
    }

    if (isNaN(delay) || delay < 0) {
        throw new errors.InvalidArgumentError('Delay must be a non-negative number.');
    }

    this.caps.typeDelay = delay;
}

export async function executeClickAndDrag(this: NovaWindows2Driver, clickAndDragArgs: {
    startElementId?: string,
    startX?: number,
    startY?: number,
    endElementId?: string,
    endX?: number,
    endY?: number,
    modifierKeys?: ModifierKeyName | ModifierKeyName[],
    durationMs?: number,
    button?: ClickType,
    smoothPointerMove?: string,
}) {
    const {
        startElementId,
        startX, startY,
        endElementId,
        endX, endY,
        modifierKeys = [],
        durationMs = 1000,
        button = ClickType.LEFT,
        smoothPointerMove,
    } = clickAndDragArgs;

    if (!startElementId && (startX == null || startY == null)) {
        if (startX != null || startY != null) {
            throw new errors.InvalidArgumentError('Both startX and startY must be provided if one is provided.');
        } else {
            this.log.info('No start coordinates or element provided. Using current cursor position for drag start.');
        }
    }

    if (!endElementId && (endX == null || endY == null)) {
        if (endX != null || endY != null) {
            throw new errors.InvalidArgumentError('Both endX and endY must be provided if one is provided.');
        } else {
            this.log.info('No end coordinates or element provided. Using current cursor position for drag end.');
        }
    }

    const mouseButton = CLICK_TYPE_BUTTON_MAP[button];
    if (mouseButton === undefined) {
        throw new errors.InvalidArgumentError(`Invalid button '${button}'. Supported values are 'left', 'middle', 'right', 'back', 'forward'.`);
    }

    // Calculate Start Position
    let startPos: [number, number];
    if (startElementId) {
        await ensureElementResolved(this, startElementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(startElementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        startPos = [
            rect.x + (startX ?? Math.trunc(rect.width / 2)),
            rect.y + (startY ?? Math.trunc(rect.height / 2))
        ];
    } else if (startX != null && startY != null) {
        startPos = [startX, startY];
    } else {
        startPos = getCursorPosition();
    }

    // Calculate End Position
    let endPos: [number, number];
    if (endElementId) {
        await ensureElementResolved(this, endElementId);

        const rectJson = await this.sendPowerShellCommand(new FoundAutomationElement(endElementId).buildGetElementRectCommand());
        const rect = parseRectJson(rectJson);
        endPos = [
            rect.x + (endX ?? Math.trunc(rect.width / 2)),
            rect.y + (endY ?? Math.trunc(rect.height / 2))
        ];
    } else if (endX != null && endY != null) {
        endPos = [endX, endY];
    } else {
        endPos = getCursorPosition();
    }

    // Perform Action — jump to start, then press-drag-release within the
    // modifier-held scope so modifiers are always released, even on error.
    await mouseMoveAbsolute(startPos[0], startPos[1], 0);
    await withModifierKeys(modifierKeys, async () => {
        mouseDown(mouseButton);
        try {
            await mouseMoveAbsolute(
                endPos[0], endPos[1],
                durationMs,
                smoothPointerMove ?? this.caps.smoothPointerMove,
                startPos[0], startPos[1]
            );
        } finally {
            mouseUp(mouseButton);
        }
    });
}
