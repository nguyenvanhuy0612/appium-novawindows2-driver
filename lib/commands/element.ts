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
} from '../powershell';
import { W3C_ELEMENT_KEY } from '@appium/base-driver';
import { mouseDown, mouseMoveAbsolute, mouseUp } from '../winapi/user32';
import { Key } from '../enums';
import { sleep } from '../util';

export async function getProperty(this: NovaWindows2Driver, propertyName: string, elementId: string): Promise<string> {
    return await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildGetPropertyCommand(propertyName));
}

export async function getAttribute(this: NovaWindows2Driver, propertyName: string, elementId: string) {
    if (propertyName) {
        this.log.warn('Warning: Use getProperty instead of getAttribute for retrieving element properties.');
    }
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

    let delayOverride: number | undefined;

    if (!Array.isArray(value)) {
        const match = value.match(/^\[delay:(\d+)\]/);
        if (match) {
            delayOverride = parseInt(match[1], 10);
            value = value.substring(match[0].length);
        }
        value = value.split('');
    }

    let keysToSend: string[] = [];

    const sendKeysAndResetArray = async () => {
        await this.sendPowerShellCommand(/* ps1 */ `[Windows.Forms.SendKeys]::SendWait(${new PSString(keysToSend.join(''))})`);
        keysToSend = [];
    };

    const typeDelay = delayOverride ?? this._typeDelay ?? this.caps.typeDelay;

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

    const focusCondition = new AndCondition(
        new PropertyCondition(Property.IS_KEYBOARD_FOCUSABLE, new PSBoolean(true)),
        new OrCondition(
            new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(ControlType.PANE)),
            new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(ControlType.WINDOW)),
        ),
    );

    try {
        const focusableElementId = await this.sendPowerShellCommand(element.findFirst(TreeScope.ANCESTORS_OR_SELF, focusCondition).buildCommand());
        await this.sendPowerShellCommand(new FoundAutomationElement(focusableElementId.trim()).buildSetFocusCommand());
    } catch {
        // ignore if it fails, focus may fail if there is a forced popup window
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