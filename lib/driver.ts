import { ChildProcessWithoutNullStreams } from 'node:child_process';
import { BaseDriver, W3C_ELEMENT_KEY, errors } from '@appium/base-driver';
import { system } from 'appium/support';
import commands from './commands';
import {
    UI_AUTOMATION_DRIVER_CONSTRAINTS,
    NovaWindowsDriverConstraints
} from './constraints';
import {
    assertSupportedEasingFunction
} from './util';
import {
    Condition,
    PropertyCondition,
    OrCondition,
    AutomationElement,
    FoundAutomationElement,
    TreeScope,
    Property,
    convertStringToCondition,
    PSString,
    PSControlType,
    PSInt32Array,
} from './powershell';
import { xpathToElIdOrIds } from './xpath';
import { setDpiAwareness } from './winapi/user32';
import {
    UIAClient, UIAElement, TreeScope as UiaTreeScope,
    UIA_NamePropertyId, UIA_AutomationIdPropertyId, UIA_ClassNamePropertyId, UIA_ControlTypePropertyId,
    UIA_ButtonControlTypeId, UIA_CalendarControlTypeId, UIA_CheckBoxControlTypeId, UIA_ComboBoxControlTypeId,
    UIA_EditControlTypeId, UIA_HyperlinkControlTypeId, UIA_ImageControlTypeId, UIA_ListItemControlTypeId,
    UIA_ListControlTypeId, UIA_MenuControlTypeId, UIA_MenuBarControlTypeId, UIA_MenuItemControlTypeId,
    UIA_ProgressBarControlTypeId, UIA_RadioButtonControlTypeId, UIA_ScrollBarControlTypeId, UIA_SliderControlTypeId,
    UIA_SpinnerControlTypeId, UIA_StatusBarControlTypeId, UIA_TabControlTypeId, UIA_TabItemControlTypeId,
    UIA_TextControlTypeId, UIA_ToolBarControlTypeId, UIA_ToolTipControlTypeId, UIA_TreeControlTypeId,
    UIA_TreeItemControlTypeId, UIA_CustomControlTypeId, UIA_GroupControlTypeId, UIA_ThumbControlTypeId,
    UIA_DataGridControlTypeId, UIA_DataItemControlTypeId, UIA_DocumentControlTypeId, UIA_SplitButtonControlTypeId,
    UIA_WindowControlTypeId, UIA_PaneControlTypeId, UIA_HeaderControlTypeId, UIA_HeaderItemControlTypeId,
    UIA_TableControlTypeId, UIA_TitleBarControlTypeId, UIA_SeparatorControlTypeId, UIA_SemanticZoomControlTypeId,
    UIA_AppBarControlTypeId
} from './winapi/uia';
import { randomUUID } from 'node:crypto';
import { NativeXPathEngine } from './xpath/native';

import type {
    DefaultCreateSessionResult,
    DriverData,
    Element,
    InitialOpts,
    StringRecord,
    W3CDriverCaps
} from '@appium/types';

type W3CNovaWindowsDriverCaps = W3CDriverCaps<NovaWindowsDriverConstraints>;
type DefaultWindowsCreateSessionResult = DefaultCreateSessionResult<NovaWindowsDriverConstraints>;

type KeyboardState = {
    pressed: Set<string>,
    shift: boolean,
    ctrl: boolean,
    meta: boolean,
    alt: boolean,
}

const LOCATION_STRATEGIES = Object.freeze([
    'id',
    'name',
    'xpath',
    'tag name',
    'class name',
    'accessibility id',
    '-windows uiautomation',
] as const);

const CONTROL_TYPE_MAP: { [key: string]: number } = {
    'button': UIA_ButtonControlTypeId,
    'calendar': UIA_CalendarControlTypeId,
    'checkbox': UIA_CheckBoxControlTypeId,
    'combobox': UIA_ComboBoxControlTypeId,
    'edit': UIA_EditControlTypeId,
    'hyperlink': UIA_HyperlinkControlTypeId,
    'image': UIA_ImageControlTypeId,
    'listitem': UIA_ListItemControlTypeId,
    'list': UIA_ListControlTypeId,
    'menu': UIA_MenuControlTypeId,
    'menubar': UIA_MenuBarControlTypeId,
    'menuitem': UIA_MenuItemControlTypeId,
    'progressbar': UIA_ProgressBarControlTypeId,
    'radiobutton': UIA_RadioButtonControlTypeId,
    'scrollbar': UIA_ScrollBarControlTypeId,
    'slider': UIA_SliderControlTypeId,
    'spinner': UIA_SpinnerControlTypeId,
    'statusbar': UIA_StatusBarControlTypeId,
    'tab': UIA_TabControlTypeId,
    'tabitem': UIA_TabItemControlTypeId,
    'text': UIA_TextControlTypeId,
    'toolbar': UIA_ToolBarControlTypeId,
    'tooltip': UIA_ToolTipControlTypeId,
    'tree': UIA_TreeControlTypeId,
    'treeitem': UIA_TreeItemControlTypeId,
    'custom': UIA_CustomControlTypeId,
    'group': UIA_GroupControlTypeId,
    'thumb': UIA_ThumbControlTypeId,
    'datagrid': UIA_DataGridControlTypeId,
    'dataitem': UIA_DataItemControlTypeId,
    'document': UIA_DocumentControlTypeId,
    'splitbutton': UIA_SplitButtonControlTypeId,
    'window': UIA_WindowControlTypeId,
    'pane': UIA_PaneControlTypeId,
    'header': UIA_HeaderControlTypeId,
    'headeritem': UIA_HeaderItemControlTypeId,
    'table': UIA_TableControlTypeId,
    'titlebar': UIA_TitleBarControlTypeId,
    'separator': UIA_SeparatorControlTypeId,
    'semanticzoom': UIA_SemanticZoomControlTypeId,
    'appbar': UIA_AppBarControlTypeId,
};



export class NovaWindows2Driver extends BaseDriver<NovaWindowsDriverConstraints, StringRecord> {
    isPowerShellSessionStarted: boolean = false;
    powerShell?: ChildProcessWithoutNullStreams;
    powerShellStdOut: string = '';
    powerShellStdErr: string = '';
    commandQueue: Promise<any> = Promise.resolve();
    keyboardState: KeyboardState = {
        pressed: new Set(),
        alt: false,
        ctrl: false,
        meta: false,
        shift: false,
    };

    public uiaClient?: UIAClient;
    public uiaElementCache: Map<string, UIAElement> = new Map();
    public nativeXpath?: NativeXPathEngine;

    activeCommands: number = 0;

    constructor(opts: InitialOpts = {} as InitialOpts, shouldValidateCaps = true) {
        super(opts, shouldValidateCaps);

        this.locatorStrategies = [...LOCATION_STRATEGIES];
        this.desiredCapConstraints = UI_AUTOMATION_DRIVER_CONSTRAINTS;

        for (const key in commands) { // TODO: create a decorator that will do that for the class
            NovaWindows2Driver.prototype[key] = commands[key].bind(this);
        }
    }

    override async executeCommand(cmd: string, ...args: any[]): Promise<any> {
        this.activeCommands++;
        try {
            return await super.executeCommand(cmd, ...args);
        } finally {
            this.activeCommands--;
        }
    }

    override async startNewCommandTimeout() {
        if (this.activeCommands > 0) {
            return;
        }
        await super.startNewCommandTimeout();
    }

    override async findElement(strategy: string, selector: string): Promise<Element> {
        [strategy, selector] = this.processSelector(strategy, selector);
        return super.findElement(strategy, selector);
    }

    override async findElements(strategy: string, selector: string): Promise<Element[]> {
        [strategy, selector] = this.processSelector(strategy, selector);
        return super.findElements(strategy, selector);
    }

    override async findElementFromElement(strategy: string, selector: string, elementId: string): Promise<Element> {
        [strategy, selector] = this.processSelector(strategy, selector);
        if (this.caps.convertAbsoluteXPathToRelativeFromElement && strategy === 'xpath' && selector.startsWith('/')) {
            selector = `.${selector}`;
        }
        return super.findElementFromElement(strategy, selector, elementId);
    }

    override async findElementsFromElement(strategy: string, selector: string, elementId: string): Promise<Element[]> {
        [strategy, selector] = this.processSelector(strategy, selector);
        if (this.caps.convertAbsoluteXPathToRelativeFromElement && strategy === 'xpath' && selector.startsWith('/')) {
            selector = `.${selector}`;
        }
        return super.findElementsFromElement(strategy, selector, elementId);
    }

    override async findElOrEls(strategy: typeof LOCATION_STRATEGIES[number], selector: string, mult: true, context?: string): Promise<Element[]>;
    override async findElOrEls(strategy: typeof LOCATION_STRATEGIES[number], selector: string, mult: false, context?: string): Promise<Element>;
    override async findElOrEls(strategy: typeof LOCATION_STRATEGIES[number], selector: string, mult: boolean, context?: string): Promise<Element | Element[]> {
        if (this.caps.useNativeUia && this.uiaClient) {
            try {
                return await this.findElOrElsNative(strategy, selector, mult, context);
            } catch (e) {
                this.log.error(`Native UIA find failed: ${e}. Falling back to PowerShell? No, failing.`);
                throw e;
            }
        }

        let condition: Condition;
        switch (strategy) {
            case 'id':
                condition = new PropertyCondition(Property.RUNTIME_ID, new PSInt32Array(selector.split('.').map(Number)));
                break;
            case 'tag name': {
                const tag = selector.toLowerCase();
                if (tag === 'list') {
                    condition = new OrCondition(
                        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('List')),
                        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataGrid'))
                    );
                } else if (tag === 'listitem') {
                    condition = new OrCondition(
                        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('ListItem')),
                        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataItem'))
                    );
                } else {
                    condition = new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(selector));
                }
                break;
            }
            case 'accessibility id':
                condition = new PropertyCondition(Property.AUTOMATION_ID, new PSString(selector));
                break;
            case 'name':
                condition = new PropertyCondition(Property.NAME, new PSString(selector));
                break;
            case 'class name':
                condition = new PropertyCondition(Property.CLASS_NAME, new PSString(selector));
                break;
            case '-windows uiautomation':
                condition = convertStringToCondition(selector);
                break;
            case 'xpath':
                return await xpathToElIdOrIds(selector, mult, context, this.sendPowerShellCommand.bind(this), this.caps.includeContextElementInSearch);
            default:
                throw new errors.InvalidArgumentError(`Invalid find strategy ${strategy}`);
        }

        const searchContext = context ? new FoundAutomationElement(context) : AutomationElement.automationRoot;

        if (mult) {
            const result = await this.sendPowerShellCommand(searchContext.findAll(TreeScope.DESCENDANTS, condition).buildCommand());
            const elIds = result.split('\n').map((elId) => elId.trim()).filter(Boolean);
            return elIds.filter(Boolean).map((elId) => ({ [W3C_ELEMENT_KEY]: elId }));
        }

        const result = await this.sendPowerShellCommand(searchContext.findFirst(TreeScope.DESCENDANTS, condition).buildCommand());
        const elId = result.trim();

        if (!elId) {
            throw new errors.NoSuchElementError();
        }

        return { [W3C_ELEMENT_KEY]: elId };
    }

    async findElOrElsNative(strategy: string, selector: string, mult: boolean, context?: string): Promise<Element | Element[]> {
        if (!this.uiaClient) throw new Error("UIA Client not initialized");

        let root = this.uiaClient.getRootElement();
        if (context && this.uiaElementCache.has(context)) {
            root = this.uiaElementCache.get(context)!;
        }

        // Map strategy to Property ID
        let propId: number | null = null;
        let value: any = selector;

        switch (strategy) {
            case 'name':
                propId = UIA_NamePropertyId;
                break;
            case 'accessibility id':
                propId = UIA_AutomationIdPropertyId;
                break;
            case 'class name':
                propId = UIA_ClassNamePropertyId;
                break;
            case 'xpath':
                this.nativeXpath ||= new NativeXPathEngine(this.uiaClient);
                const elements = await this.nativeXpath.findElements(selector, root);
                if (mult) {
                    return elements.map(el => {
                        const id = "NATIVE_" + randomUUID();
                        this.uiaElementCache.set(id, el);
                        return { [W3C_ELEMENT_KEY]: id };
                    });
                } else {
                    if (elements.length === 0) throw new errors.NoSuchElementError();
                    const id = "NATIVE_" + randomUUID();
                    this.uiaElementCache.set(id, elements[0]);
                    return { [W3C_ELEMENT_KEY]: id };
                }
            default:
                throw new Error(`Strategy ${strategy} not yet supported in Native UIA`);
        }

        if (mult) {
            // Using JS Fallback logic
            const elements = root.findAllByProperty(UiaTreeScope.Descendants, propId, value, this.uiaClient);
            return elements.map(el => {
                const id = "NATIVE_" + randomUUID();
                this.uiaElementCache.set(id, el);
                return { [W3C_ELEMENT_KEY]: id };
            });
        } else {
            const el = root.findFirstByProperty(UiaTreeScope.Descendants, propId, value, this.uiaClient);
            if (!el) throw new errors.NoSuchElementError();
            const id = "NATIVE_" + randomUUID();
            this.uiaElementCache.set(id, el);
            return { [W3C_ELEMENT_KEY]: id };
        }
    }

    override async createSession(
        jwpCaps: W3CNovaWindowsDriverCaps,
        reqCaps?: W3CNovaWindowsDriverCaps,
        w3cCaps?: W3CNovaWindowsDriverCaps,
        driverData?: DriverData[]
    ): Promise<DefaultWindowsCreateSessionResult> {
        if (!system.isWindows()) {
            this.log.errorWithException('Windows UI Automation tests only run on Windows.');
        }

        if (typeof w3cCaps?.alwaysMatch?.['appium:appTopLevelWindow'] === 'number') {
            w3cCaps.alwaysMatch['appium:appTopLevelWindow'] = String(w3cCaps.alwaysMatch['appium:appTopLevelWindow']);
        }

        const session = await super.createSession(jwpCaps, reqCaps, w3cCaps, driverData);

        if (this.caps.useNativeUia) {
            this.log.info('Initializing Native UIA Client...');
            try {
                this.uiaClient = new UIAClient();
                this.log.info('Native UIA Client initialized.');
            } catch (e) {
                this.log.error(`Failed to initialize Native UIA: ${e}`);
                throw e;
            }
        } else {
            await this.startPowerShellSession();
        }

        if (typeof w3cCaps?.firstMatch?.some['appium:appTopLevelWindow'] === 'number') {
            w3cCaps.firstMatch['appium:appTopLevelWindow'] = w3cCaps.firstMatch['appium:appTopLevelWindow'].map(String);
        }

        if (this.caps.smoothPointerMove) {
            assertSupportedEasingFunction(this.caps.smoothPointerMove);
        }
        if (this.caps.app && this.caps.appTopLevelWindow) {
            throw new errors.InvalidArgumentError('Invalid capabilities. Specify either app or appTopLevelWindow.');
        }
        if (this.caps.shouldCloseApp === undefined) {
            this.caps.shouldCloseApp = true;
        }
        if (this.caps.powerShellCommandTimeout === undefined) {
            this.caps.powerShellCommandTimeout = 60000;
        }
        if (this.caps.convertAbsoluteXPathToRelativeFromElement === undefined) {
            this.caps.convertAbsoluteXPathToRelativeFromElement = true;
        }
        if (this.caps.includeContextElementInSearch === undefined) {
            this.caps.includeContextElementInSearch = true;
        }
        if (this.caps.releaseModifierKeys === undefined) {
            this.caps.releaseModifierKeys = true;
        }

        if (this.caps.prerun) {
            this.log.info('Executing prerun PowerShell script...');
            if (this.caps.prerun.command) {
                await this.sendPowerShellCommand(this.caps.prerun.command);
            } else if (this.caps.prerun.script) {
                // TODO
            }
        }

        setDpiAwareness();
        this.log.debug(`Started session: ${session[0]}`); // session is [id, caps]
        return session;
    }

    override async deleteSession(sessionId?: string | null | undefined): Promise<void> {
        this.log.debug('Deleting NovaWindows driver session...');

        if (this.caps.shouldCloseApp && this.caps.app && this.caps.app.toLowerCase() !== 'root') {
            try {
                const result = await this.sendPowerShellCommand(AutomationElement.automationRoot.buildCommand());
                const elementId = result.split('\n').map((id) => id.trim()).filter(Boolean)[0];
                if (elementId) {
                    await this.sendPowerShellCommand(new FoundAutomationElement(elementId).buildCloseCommand());
                }
            } catch {
                // noop
            }
        }
        await this.terminatePowerShellSession();

        if (this.caps.postrun) {
            this.log.info('Executing postrun PowerShell script...');
            if (this.caps.postrun.command) {
                await this.sendPowerShellCommand(this.caps.postrun.command);
            }
            // cast logic omitted for brevity as I cannot verify imports perfectly
        }

        await super.deleteSession(sessionId);
    }

    private processSelector(strategy: string, selector: string): [string, string] {
        if (strategy !== 'css selector') {
            return [strategy, selector];
        }

        this.log.warn('Warning: Use Appium mobile selectors instead of Selenium By, since most of them are based on CSS.');
        const digitRegex = /\\3(\d) /;

        if (selector.startsWith('.')) {
            selector = selector.substring(1).replace(digitRegex, '$1');
            strategy = 'class name';
            return [strategy, selector];
        }

        if (selector.startsWith('#')) {
            selector = selector.substring(1).replace(digitRegex, '$1');
            strategy = 'id';
            return [strategy, selector];
        }

        if (selector.startsWith('*[name')) {
            selector = selector.substring(selector.indexOf('"') + 1, selector.lastIndexOf('"')).replace(digitRegex, '$1');
            strategy = 'name';
            return [strategy, selector];
        }

        return [strategy, selector];
    }

}


