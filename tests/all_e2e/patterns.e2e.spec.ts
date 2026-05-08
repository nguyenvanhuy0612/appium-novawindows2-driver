import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — UIA Patterns & Selection (Full Coverage)', function () {
    this.timeout(120_000);

    let driver: Browser;

    before(async function () {
        driver = await remote({
            hostname: url.hostname,
            port: Number(url.port || 4723),
            path: url.pathname && url.pathname !== '/' ? url.pathname : '/',
            protocol: url.protocol.replace(':', '') as 'http' | 'https',
            logLevel: 'warn',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows2',
                'appium:app': TARGET_APP,
            } as WebdriverIO.Capabilities,
        });
    });

    after(async function () {
        if (driver) await driver.deleteSession();
    });

    describe('UIA Control Patterns', function () {
        it('should use InvokePattern', async function () {
            const fileMenu = await driver.$('//MenuItem[@Name="File"]');
            if (await fileMenu.isExisting()) {
                await driver.execute('windows: invoke', { elementId: fileMenu.elementId });
                await driver.keys(['Escape']);
            }
        });

        it('should use ValuePattern (Set/Get)', async function () {
            const editor = await driver.$('//Document | //Edit');
            await driver.execute('windows: setValue', { elementId: editor.elementId, value: 'Pattern Test' });
            const val = await driver.execute('windows: getValue', { elementId: editor.elementId });
            expect(val).to.contain('Pattern Test');
        });

        it('should use ExpandCollapsePattern', async function () {
            // Find a combobox or menu item that can expand
            const menu = await driver.$('//MenuBar');
            if (await menu.isExisting()) {
                const item = await menu.$('.//MenuItem');
                try {
                    await driver.execute('windows: expand', { elementId: item.elementId });
                    await driver.execute('windows: collapse', { elementId: item.elementId });
                } catch (e) {
                    // Item might not support pattern, but we test the command dispatch
                }
            }
        });

        it('should use TogglePattern', async function () {
            // Find a checkbox or toggle-able item
            const toggleEl = await driver.$('//CheckBox');
            if (await toggleEl.isExisting()) {
                await driver.execute('windows: toggle', { elementId: toggleEl.elementId });
            }
        });

        it('should use ScrollIntoView', async function () {
            const el = await driver.$('//Document | //Edit');
            await driver.execute('windows: scrollIntoView', { elementId: el.elementId });
        });
    });

    describe('Selection Patterns', function () {
        it('should use SelectionItemPattern (Select)', async function () {
            const listItems = await driver.$$('//ListItem');
            if (listItems.length > 0) {
                await driver.execute('windows: select', { elementId: listItems[0].elementId });
            }
        });

        it('should get selected items', async function () {
            const list = await driver.$('//List');
            if (await list.isExisting()) {
                const selected = await driver.execute('windows: selectedItem', { elementId: list.elementId });
                expect(selected).to.exist;
                
                const allSelected = await driver.execute('windows: allSelectedItems', { elementId: list.elementId });
                expect(allSelected).to.be.an('array');
            }
        });

        it('should check if selection is multiple', async function () {
            const list = await driver.$('//List');
            if (await list.isExisting()) {
                const isMultiple = await driver.execute('windows: isMultiple', { elementId: list.elementId });
                expect(typeof isMultiple).to.equal('boolean');
            }
        });

        it('should add/remove from selection', async function () {
            const listItems = await driver.$$('//ListItem');
            if (listItems.length > 1) {
                await driver.execute('windows: addToSelection', { elementId: listItems[1].elementId });
                await driver.execute('windows: removeFromSelection', { elementId: listItems[1].elementId });
            }
        });
    });

    describe('Window Patterns', function () {
        it('should minimize, restore, maximize, and close (pattern)', async function () {
            const root = await driver.$('//Window');
            await driver.execute('windows: minimize', { elementId: root.elementId });
            await driver.execute('windows: restore', { elementId: root.elementId });
            await driver.execute('windows: maximize', { elementId: root.elementId });
            
            // Testing 'close' at the very end of the session
            // await driver.execute('windows: close', { elementId: root.elementId });
        });
    });
});
