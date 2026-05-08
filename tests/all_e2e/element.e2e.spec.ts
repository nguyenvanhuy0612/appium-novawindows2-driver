import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — Element Properties', function () {
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

    it('should get element name', async function () {
        const root = await driver.$('//Window');
        const name = await root.getElementTagName();
        expect(name).to.be.a('string').and.not.empty;
    });

    it('should get element text', async function () {
        const root = await driver.$('//Window');
        const text = await root.getText();
        expect(text).to.be.a('string');
    });

    it('should get element rect', async function () {
        const root = await driver.$('//Window');
        const rect = await root.getElementRect();
        expect(rect.x).to.be.a('number');
        expect(rect.y).to.be.a('number');
        expect(rect.width).to.be.a('number').and.greaterThan(0);
        expect(rect.height).to.be.a('number').and.greaterThan(0);
    });

    it('should check if element is displayed', async function () {
        const root = await driver.$('//Window');
        const displayed = await root.isDisplayed();
        expect(displayed).to.be.true;
    });

    it('should check if element is enabled', async function () {
        const root = await driver.$('//Window');
        const enabled = await root.isEnabled();
        expect(enabled).to.be.true;
    });

    it('should get custom properties via getProperty', async function () {
        const root = await driver.$('//Window');
        const automationId = await root.getProperty('AutomationId');
        expect(automationId).to.be.a('string');
        
        const className = await root.getProperty('ClassName');
        expect(className).to.be.a('string').and.not.empty;
    });

    it('should get pattern properties via dot-notation', async function () {
        const root = await driver.$('//Window');
        const canMaximize = await root.getProperty('Window.CanMaximize');
        expect(['True', 'False']).to.contain(canMaximize);
    });

    it('should get legacy properties via dot-notation', async function () {
        const root = await driver.$('//Window');
        const legacyName = await root.getProperty('LegacyIAccessible.Name');
        expect(legacyName).to.be.a('string');
    });

    it('should get element source via getProperty("source")', async function () {
        const root = await driver.$('//Window');
        const source = await root.getProperty('source');
        expect(source).to.contain('<Window');
    });

    it('should get all properties via getProperty("all")', async function () {
        const root = await driver.$('//Window');
        const all = await root.getProperty('all');
        expect(all).to.be.a('string');
        const parsed = JSON.parse(all);
        expect(parsed).to.have.property('AutomationId');
    });

    it('should take an element screenshot', async function () {
        const root = await driver.$('//Window');
        const screenshot = await driver.takeElementScreenshot(root.elementId);
        expect(screenshot).to.be.a('string').and.not.empty;
    });

    it('should check if element is selected', async function () {
        const root = await driver.$('//Window');
        const selected = await root.isSelected();
        expect(selected).to.be.false; // Windows usually false for top-level window
    });

    it('should get all attributes via windows: getAttributes', async function () {
        const root = await driver.$('//Window');
        const attrs = await driver.execute('windows: getAttributes', { elementId: root.elementId });
        expect(attrs).to.be.a('string');
        const parsed = JSON.parse(attrs);
        expect(parsed).to.have.property('AutomationId');
    });
});
