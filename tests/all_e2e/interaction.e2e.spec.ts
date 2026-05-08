import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — User Interactions', function () {
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

    it('should type and clear text in Notepad editor', async function () {
        // Find the main editor element. In Win11 it's usually Document control.
        const editor = await driver.$('//Document | //Edit');
        expect(await editor.isExisting()).to.be.true;

        await editor.click();
        
        const testText = 'Hello NovaWindows2 Driver!';
        await editor.setValue(testText);
        
        const currentText = await editor.getText();
        // getText might return more than just the content depending on UIA implementation, 
        // but it should at least contain what we typed.
        expect(currentText).to.contain(testText);

        await editor.clearValue();
        const clearedText = await editor.getText();
        expect(clearedText.trim()).to.be.empty;
    });

    it('should perform complex key actions', async function () {
        const editor = await driver.$('//Document | //Edit');
        await editor.click();

        // Type something then select all and delete
        await driver.keys(['C', 'o', 'n', 't', 'r', 'o', 'l', 'a']); // Ctrl+A
        await driver.keys(['Backspace']);
        
        await driver.keys(['T', 'e', 's', 't']);
        expect(await editor.getText()).to.contain('Test');
    });

    it('should perform mouse actions (drag and drop or move)', async function () {
        const editor = await driver.$('//Document | //Edit');
        const rect = await editor.getElementRect();
        
        // Move mouse to editor center
        await driver.performActions([{
            type: 'pointer',
            id: 'mouse',
            parameters: { pointerType: 'mouse' },
            actions: [
                { type: 'pointerMove', duration: 500, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
                { type: 'pointerDown', button: 0 },
                { type: 'pointerUp', button: 0 }
            ]
        }]);
    });

    it('should perform wheel actions (scroll)', async function () {
        await driver.performActions([{
            type: 'wheel',
            id: 'wheel',
            actions: [
                { type: 'scroll', duration: 0, x: 0, y: 0, deltaX: 0, deltaY: 100 },
                { type: 'scroll', duration: 0, x: 0, y: 0, deltaX: 0, deltaY: -100 }
            ]
        }]);
    });

    it('should release actions', async function () {
        await driver.releaseActions();
    });
});
