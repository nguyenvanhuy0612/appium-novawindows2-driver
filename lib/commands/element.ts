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

// Maps lowercase dot-prefix to the full UIA pattern class name
// (used as [System.Windows.Automation.<className>]::Pattern in PowerShell).
// Pattern2 variants use their actual class names which differ from the simple "${name}Pattern" convention.
// Ref: https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-controlpatternsoverview
const PATTERN_MAP: Record<string, string> = {
    // Standard patterns
    'value':            'ValuePattern',
    'window':           'WindowPattern',
    'transform':        'TransformPattern',
    'toggle':           'TogglePattern',
    'expandcollapse':   'ExpandCollapsePattern',
    'rangevalue':       'RangeValuePattern',
    'selection':        'SelectionPattern',
    'selectionitem':    'SelectionItemPattern',
    'scroll':           'ScrollPattern',
    'grid':             'GridPattern',
    'griditem':         'GridItemPattern',
    'table':            'TablePattern',
    'tableitem':        'TableItemPattern',
    'dock':             'DockPattern',
    'multipleview':     'MultipleViewPattern',
    'annotation':       'AnnotationPattern',
    'drag':             'DragPattern',
    'droptarget':       'DropTargetPattern',
    'spreadsheet':      'SpreadsheetPattern',
    'spreadsheetitem':  'SpreadsheetItemPattern',
    'styles':           'StylesPattern',
    'text':             'TextPattern',
    'textchild':        'TextChildPattern',
    // Pattern2 variants — class name does NOT follow "${name}Pattern" convention.
    // Two keys per variant: short form (e.g. "transform2.x") and the programmatic-name
    // form emitted by GetSupportedProperties() (e.g. "TransformPattern2.x"), so both work.
    'transform2':           'TransformPattern2',
    'transformpattern2':    'TransformPattern2',
    'selection2':           'SelectionPattern2',
    'selectionpattern2':    'SelectionPattern2',
    'textpattern2':         'TextPattern2',   // "textpattern2.x" covers both forms
};

// Maps lowercase Legacy shorthand aliases to the canonical prop name used by LegacyIAccessiblePattern.Current and Win32Helper
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

// Maps any lowercase UIA property key (pattern or direct) to a LegacyIAccessible prop name.
// Used as MSAA fallback when UIA returns empty for Win32 MSAA proxy elements.
// Pattern keys contain a dot (e.g. "value.value"); direct keys do not (e.g. "name").
// Ref: https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-msaa
const LEGACY_FALLBACK: Record<string, string> = {
    'value.value':    'Value',            // ValuePattern.Value            <- accValue
    'name':           'Name',             // UIA_NamePropertyId            <- accName
    'helptext':       'Help',             // UIA_HelpTextPropertyId        <- accHelp
    'accesskey':      'KeyboardShortcut', // UIA_AccessKeyPropertyId       <- accKeyboardShortcut
    'acceleratorkey': 'KeyboardShortcut', // UIA_AcceleratorKeyPropertyId  <- accKeyboardShortcut
};

export async function getProperty(this: NovaWindows2Driver, propertyName: string, elementId: string): Promise<string> {
    const el = new FoundAutomationElement(elementId);
    const lowerKey = propertyName.toLowerCase();

    // If result is empty, fall back to the LegacyIAccessible equivalent (Win32 MSAA proxy elements
    // may return empty for UIA properties where the MSAA value is correctly populated).
    const withLegacyFallback = async (result: string): Promise<string> => {
        const legacyProp = LEGACY_FALLBACK[lowerKey];
        if (!result?.trim() && legacyProp) {
            return await this.sendPowerShellCommand(el.buildGetLegacyPropertyCommand(legacyProp));
        }
        return result;
    };

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
            const patternClass = PATTERN_MAP[prefix];
            const propName = propertyName.slice(dotIdx + 1);
            const result = await this.sendPowerShellCommand(el.buildGetPatternPropertyCommand(patternClass, propName));
            return withLegacyFallback(result);
        }
    }

    // 4. XML source for this element and its subtree
    if (lowerKey === 'source') {
        return await this.sendPowerShellCommand(el.buildGetSourceCommand());
    }

    // 5. Dump all properties as JSON
    if (lowerKey === 'all') {
        return await this.sendPowerShellCommand(el.buildGetAllPropertiesCommand());
    }

    // 5. UIA direct property (e.g. "Name", "AutomationId", "ClassName", "RuntimeId", "ControlType")
    const normalizedProp = propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    const result = await this.sendPowerShellCommand(el.buildGetPropertyCommand(normalizedProp));
    return withLegacyFallback(result);
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
    const element = new FoundAutomationElement(elementId);

    // Normalize to a flat string first so delay-prefix parsing and char iteration are consistent
    const rawString = Array.isArray(value) ? value.join('') : value;

    let typeDelay = this.caps.typeDelay ?? 0;
    let processedString = rawString;

    if (typeDelay > 0) {
        const match = rawString.match(/^\[delay:\s*(\d+)\]/i);
        if (match) {
            typeDelay = parseInt(match[1], 10);
            processedString = rawString.substring(match[0].length);
        }
    }

    // Flat char array — consistent regardless of whether value was string or string[]
    const chars = [...processedString];

    // Try SetFocus; if it fails and value is plain text, fall back to ValuePattern.SetValue directly
    let focusSet = false;
    try {
        await this.sendPowerShellCommand(element.buildSetFocusCommand());
        focusSet = true;
    } catch (e: any) {
        this.log.debug(`[setValue] SetFocus failed: ${e.message}`);
    }

    const isPlainText = chars.every((c) => c.charCodeAt(0) < 0xE000);
    if (!focusSet && isPlainText) {
        this.log.info('[setValue] SetFocus unavailable — using ValuePattern.SetValue as fallback');
        await this.sendPowerShellCommand(element.buildSetValueCommand(processedString));
        return;
    }

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
        if (keysToSend.length === 0) return;
        await this.sendPowerShellCommand(/* ps1 */ `[Windows.Forms.SendKeys]::SendWait(${new PSString(keysToSend.join(''))})`);
        keysToSend = [];
    };

    for (const char of chars) {
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
                    keysToSend.push(char.replace(/[+^%~()]/g, '{$&}'));
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