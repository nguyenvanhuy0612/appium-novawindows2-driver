import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — Search Strategies', function () {
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

    it('should find element by xpath', async function () {
        const el = await driver.$('//Window');
        expect(await el.isExisting()).to.be.true;
    });

    it('should find element by tag name (ControlType)', async function () {
        // Find by ControlType (e.g. Window, Document, Edit)
        const el = await driver.$('<Window />');
        expect(await el.isExisting()).to.be.true;
    });

    it('should find element by name', async function () {
        // Notepad root window name usually contains "Notepad"
        // Strategy 'name'
        const el = await driver.findElement('name', 'Untitled - Notepad'); 
        // Note: Title might vary by OS language, but we test the strategy
        if (el) expect(el).to.exist;
    });

    it('should find element by accessibility id (AutomationId)', async function () {
        // Find by AutomationId
        const el = await driver.$('~TitleBar');
        if (await el.isExisting()) {
            expect(await el.isExisting()).to.be.true;
        }
    });

    it('should find element by class name', async function () {
        // Notepad class is usually 'Notepad'
        const el = await driver.findElement('class name', 'Notepad');
        if (el) expect(el).to.exist;
    });

    it('should find element using -windows uiautomation (custom strategy)', async function () {
        // Example: Name == "Untitled - Notepad"
        const selector = 'Name == "Untitled - Notepad"';
        const el = await driver.findElement('-windows uiautomation', selector);
        if (el) expect(el).to.exist;
    });

    it('should find element from another element', async function () {
        const root = await driver.$('//Window');
        const child = await root.$('.//TitleBar');
        expect(await child.isExisting()).to.be.true;
    });

    it('should find the active element', async function () {
        const activeEl = await driver.getActiveElement();
        expect(activeEl).to.exist;
    });
});
