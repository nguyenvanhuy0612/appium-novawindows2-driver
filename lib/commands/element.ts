import { Element, Rect } from '@appium/types';
import { NovaWindows2Driver } from '../driver';
import {
    AndCondition,
    AutomationElement,
    ControlType,
    FoundAutomationElement,
    OrCondition,
    Property,
    PropertyCondition,
    PSBoolean,
    PSControlType,
    PSString,
    TreeScope,
    TrueCondition,
} from '../powershell';
import { W3C_ELEMENT_KEY } from '@appium/base-driver';
import { mouseDown, mouseMoveAbsolute, mouseUp } from '../winapi/user32';
import { Key } from '../enums';
import { sleep } from '../util';

// Maps lowercase dot-prefix to the PascalCase UIA pattern class name
const PATTERN_MAP: Record<string, string> = {
    'value': 'Value',
    'window': 'Window',
    'transform': 'Transform',
    'toggle': 'Toggle',
    'expandcollapse': 'ExpandCollapse',
    'rangevalue': 'RangeValue',
    'selection': 'Selection',
    'selectionitem': 'SelectionItem',
    'scroll': 'Scroll',
    'grid': 'Grid',
    'griditem': 'GridItem',
    'table': 'Table',
    'tableitem': 'TableItem',
    'dock': 'Dock',
    'multipleview': 'MultipleView',
};

// Maps lowercase Legacy shorthand aliases to the canonical prop name used by LegacyIAccessiblePattern.Current and MSAAHelper
const LEGACY_ALIAS_MAP: Record<string, string> = {
    'legacyname': 'Name',
    'legacyvalue': 'Value',
    'legacydescription': 'Description',
    'legacyrole': 'Role',
    'legacystate': 'State',
    'legacyhelp': 'Help',
    'legacykeyboardshortcut': 'KeyboardShortcut',
    'legacydefaultaction': 'DefaultAction',
    'legacychildid': 'ChildId',
};

export async function getProperty(this: NovaWindows2Driver, propertyName: string, elementId: string): Promise<string> {
    const el = new FoundAutomationElement(elementId);
    const lowerKey = propertyName.toLowerCase();

    // 1. Legacy shorthand alias (e.g. "LegacyName", "LegacyValue")
    if (lowerKey in LEGACY_ALIAS_MAP) {
        return await this.sendPowerShellCommand(el.buildGetLegacyPropertyCommand(LEGACY_ALIAS_MAP[lowerKey]));
    }

    // 2. LegacyIAccessible dot-notation (e.g. "LegacyIAccessible.Name")
    if (lowerKey.startsWith('legacyiaccessible.')) {
        const propName = propertyName.slice('LegacyIAccessible.'.length);
        return await this.sendPowerShellCommand(el.buildGetLegacyPropertyCommand(propName));
    }

    // 3. UIA Pattern dot-notation (e.g. "Toggle.ToggleState", "Value.Value", "Window.CanMaximize")
    const dotIdx = lowerKey.indexOf('.');
    if (dotIdx !== -1) {
        const prefix = lowerKey.slice(0, dotIdx);
        if (prefix in PATTERN_MAP) {
            const patternName = PATTERN_MAP[prefix];
            const propName = propertyName.slice(dotIdx + 1);
            return await this.sendPowerShellCommand(el.buildGetPatternPropertyCommand(patternName, propName));
        }
    }

    // 4. Dump all properties
    if (lowerKey === 'all') {
        return await this.sendPowerShellCommand(el.buildGetAllPropertiesCommand());
    }

    // 5. UIA direct property (also handles 'runtimeid', 'controltype')
    const normalizedProp = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    return await this.sendPowerShellCommand(el.buildGetPropertyCommand(normalizedProp));
}

export async function getAttribute(this: NovaWindows2Driver, propertyName: string, elementId: string) {
    this.log.warn('Warning: Use getProperty instead of getAttribute for retrieving element properties.');
    return await this.getProperty(propertyName, elementId);
}

export async function active(this: NovaWindows2Driver): Promise<Element> {
    return { [W3C_ELEMENT_KEY]: await this.sendPowerShellCommand(AutomationElement.focusedElement.buildCommand()) };
}

export async function getName(this: NovaWindows2Driver, elementId: string): Promise<string> {
    return await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetTagNameCommand());
}

export async function getText(this: NovaWindows2Driver, elementId: string): Promise<string> {
    return await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetTextCommand());
}

export async function clear(this: NovaWindows2Driver, elementId: string): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildSetValueCommand(''));
}

export async function setValue(this: NovaWindows2Driver, value: string | string[], elementId: string): Promise<void> {
    await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildSetFocusCommand());
    const metaKeyStates: {
        shift?: string;
        ctrl?: string;
        meta?: string;
        alt?: string;
    } = {
        shift: undefined,
        ctrl: undefined,
        meta: undefined,
        alt: undefined,
    };
    let keysToSend: string[] = [];

    const sendKeysAndResetArray = async () => {
        await this.sendPowerShellCommand(/* ps1 */ `[Windows.Forms.SendKeys]::SendWait(${new PSString(keysToSend.join(''))})`);
        keysToSend = [];
    };

    const parseDelay = (defaultDelay: number, text: string): { delay: number; textWithoutDelay: string } => {
        const match = text.match(/^\[delay:\s*(\d+)\]/i);
        if (match) {
            const delay = parseInt(match[1], 10);
            const textWithoutDelay = text.substring(match[0].length);
            return { delay, textWithoutDelay };
        }
        return { delay: defaultDelay, textWithoutDelay: text };
    };

    let typeDelay = this.caps.typeDelay ?? 0;

    if (typeDelay > 0) {
        if (!Array.isArray(value)) {
            const { delay, textWithoutDelay } = parseDelay(typeDelay, value as string);
            typeDelay = delay;
            value = textWithoutDelay;
        } else {
            const { delay, textWithoutDelay } = parseDelay(typeDelay, value.join(''));
            typeDelay = delay;
            value = textWithoutDelay.split('');
        }
    }

    for (const char of value) {
        switch (char) {
            case Key.SHIFT:
            case Key.R_SHIFT:
                await sendKeysAndResetArray();
                if (metaKeyStates.shift) {
                    await this.handleKeyActionSequence({
                        type: 'key',
                        id: 'default keyboard',
                        actions: [{ type: 'keyUp', value: char }]
                    });
                    metaKeyStates.shift = undefined;
                    break;
                }

                metaKeyStates.shift = char;
                await this.handleKeyActionSequence({
                    type: 'key',
                    id: 'default keyboard',
                    actions: [{ type: 'keyDown', value: char }]
                });
                break;
            case Key.CONTROL:
            case Key.R_CONTROL:
                await sendKeysAndResetArray();
                if (metaKeyStates.ctrl) {
                    await this.handleKeyActionSequence({
                        type: 'key',
                        id: 'default keyboard',
                        actions: [{ type: 'keyUp', value: char }]
                    });
                    metaKeyStates.ctrl = undefined;
                    break;
                }

                metaKeyStates.ctrl = char;
                await this.handleKeyActionSequence({
                    type: 'key',
                    id: 'default keyboard',
                    actions: [{ type: 'keyDown', value: char }]
                });
                break;
            case Key.META:
            case Key.R_META:
                await sendKeysAndResetArray();
                if (metaKeyStates.meta) {
                    await this.handleKeyActionSequence({
                        type: 'key',
                        id: 'default keyboard',
                        actions: [{ type: 'keyUp', value: char }]
                    });
                    metaKeyStates.meta = undefined;
                    break;
                }

                metaKeyStates.meta = char;
                await this.handleKeyActionSequence({
                    type: 'key',
                    id: 'default keyboard',
                    actions: [{ type: 'keyDown', value: char }]
                });
                break;
            case Key.ALT:
            case Key.R_ALT:
                await sendKeysAndResetArray();
                if (metaKeyStates.alt) {
                    await this.handleKeyActionSequence({
                        type: 'key',
                        id: 'default keyboard',
                        actions: [{ type: 'keyUp', value: char }]
                    });
                    metaKeyStates.alt = undefined;
                    break;
                }

                metaKeyStates.alt = char;
                await this.handleKeyActionSequence({
                    type: 'key',
                    id: 'default keyboard',
                    actions: [{ type: 'keyDown', value: char }]
                });
                break;
            default:
                if (char.charCodeAt(0) >= 0xE000) {
                    await sendKeysAndResetArray();
                    await this.handleKeyActionSequence({
                        type: 'key',
                        id: 'default keyboard',
                        actions: [{ type: 'keyDown', value: char }, { type: 'keyUp', value: char }]
                    });
                    if (typeDelay) {
                        await sleep(typeDelay);
                    }
                } else {
                    keysToSend.push(char.replace(/[+^%~()]/, '{$&}'));
                    if (typeDelay) {
                        await sendKeysAndResetArray();
                        await sleep(typeDelay);
                    }
                }
        }
    }

    await sendKeysAndResetArray();

    if (this.caps.releaseModifierKeys) {
        if (metaKeyStates.shift) {
            await this.handleKeyActionSequence({
                type: 'key',
                id: 'default keyboard',
                actions: [{ type: 'keyUp', value: metaKeyStates.shift }]
            });
        }
        if (metaKeyStates.ctrl) {
            await this.handleKeyActionSequence({
                type: 'key',
                id: 'default keyboard',
                actions: [{ type: 'keyUp', value: metaKeyStates.ctrl }]
            });
        }
        if (metaKeyStates.meta) {
            await this.handleKeyActionSequence({
                type: 'key',
                id: 'default keyboard',
                actions: [{ type: 'keyUp', value: metaKeyStates.meta }]
            });
        }
        if (metaKeyStates.alt) {
            await this.handleKeyActionSequence({
                type: 'key',
                id: 'default keyboard',
                actions: [{ type: 'keyUp', value: metaKeyStates.alt }]
            });
        }
    }
}

export async function getElementRect(this: NovaWindows2Driver, elementId: string): Promise<Rect> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetElementRectCommand());
    const rootRectJson = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildGetElementRectCommand());
    const rootRect = JSON.parse(rootRectJson.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString())) as Rect;
    const rect = JSON.parse(result.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString())) as Rect;
    rect.x -= rootRect.x;
    rect.y -= rootRect.y;
    rect.x = Math.min(0x7FFFFFFF, rect.x);
    rect.y = Math.min(0x7FFFFFFF, rect.y);
    return rect;
}

export async function elementDisplayed(this: NovaWindows2Driver, elementId: string): Promise<boolean> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetPropertyCommand(Property.IS_OFFSCREEN));
    return result.toLowerCase() === 'true' ? false : true;
}

// TODO: find better way to handle whether to use select or toggle
export async function elementSelected(this: NovaWindows2Driver, elementId: string): Promise<boolean> {
    try {
        const result = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildIsSelectedCommand());
        return result === 'True';
    } catch {
        const result = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetToggleStateCommand());
        return result === 'On';
    }
}

export async function elementEnabled(this: NovaWindows2Driver, elementId: string): Promise<boolean> {
    const result = await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetPropertyCommand(Property.IS_ENABLED));
    return result.toLowerCase() === 'true' ? true : false;
}

export async function click(this: NovaWindows2Driver, elementId: string): Promise<void> {
    const easingFunction = this.caps.smoothPointerMove;
    const element = new FoundAutomationElement(elementId);

    // 1. Bring application "on-top" by focusing the closest Window/Pane ancestor
    //    Note: don't filter by IsKeyboardFocusable — some apps (e.g. SecureAge) report
    //    their main window as not focusable, but SetFocus() still works on them.
    const containerCondition = new OrCondition(
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(ControlType.PANE)),
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(ControlType.WINDOW)),
    );

    try {
        const ancestorId = await this.sendPowerShellCommand(element.findFirst(TreeScope.ANCESTORS_OR_SELF, containerCondition).buildCommand());
        if (ancestorId && ancestorId.trim()) {
            const id = ancestorId.trim();
            this.log.info(`[Click] Bringing on-top by focusing ancestor: ${id}`);
            try {
                await this.sendPowerShellCommand(new FoundAutomationElement(id).buildSetFocusCommand());
            } catch {
                // SetFocus failed (window not focusable) — fallback to SetForegroundWindow via native handle
                this.log.info(`[Click] SetFocus failed, trying SetForegroundWindow for ancestor: ${id}`);
                await this.sendPowerShellCommand(new FoundAutomationElement(id).buildBringToFrontCommand());
            }
        } else {
            this.log.warn(`[Click] Could not find a Window/Pane ancestor for element ${elementId}`);
        }
    } catch (e: any) {
        this.log.debug(`[Click] Failed to bring ancestor on-top: ${e.message}`);
    }

    // 2. Scroll element into view (tries ScrollItemPattern, SetFocus, LegacyIAccessible)
    try {
        await this.sendPowerShellCommand(element.buildScrollIntoViewCommand());
    } catch (e: any) {
        this.log.debug(`[Click] ScrollIntoView failed for element ${elementId}: ${e.message}`);
    }

    const coordinates = {
        x: undefined,
        y: undefined,
    } as Partial<Rect>;

    try {
        const clickablePointJson = await this.sendPowerShellCommand(element.buildGetPropertyCommand(Property.CLICKABLE_POINT));
        const clickablePoint = JSON.parse(clickablePointJson.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString())) as Rect;
        coordinates.x = clickablePoint.x;
        coordinates.y = clickablePoint.y;
    } catch {
        const rectJson = await this.sendPowerShellCommand(element.buildGetElementRectCommand());
        const rect = JSON.parse(rectJson.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString())) as Rect;
        coordinates.x = rect.x + rect.width / 2;
        coordinates.y = rect.y + rect.height / 2;
    }

    await mouseMoveAbsolute(coordinates.x, coordinates.y, this.caps.delayBeforeClick ?? 0, easingFunction);

    mouseDown();
    mouseUp();

    if (this.caps.delayAfterClick) {
        await sleep(this.caps.delayAfterClick ?? 0);
    }
}

export async function getElementScreenshot(this: NovaWindows2Driver, elementId: string): Promise<string> {
    return await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetElementScreenshotCommand());
}