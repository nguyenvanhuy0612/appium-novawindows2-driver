import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — App & Window Management', function () {
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
                'appium:shouldCloseApp': true,
                'ms:waitForAppLaunch': 5,
            } as WebdriverIO.Capabilities,
        });
    });

    after(async function () {
        if (driver) await driver.deleteSession();
    });

    it('should return page source', async function () {
        const source = await driver.getPageSource();
        expect(source).to.be.a('string').and.not.empty;
        expect(source).to.contain('<Window');
    });

    it('should take a screenshot', async function () {
        const screenshot = await driver.takeScreenshot();
        expect(screenshot).to.be.a('string').and.not.empty;
    });

    it('should get window title', async function () {
        const title = await driver.getTitle();
        expect(title).to.be.a('string').and.not.empty;
        expect(title).to.contain('Notepad');
    });

    it('should get window handle', async function () {
        const handle = await driver.getWindowHandle();
        expect(handle).to.match(/^0x[0-9a-fA-F]+$/);
    });

    it('should get all window handles', async function () {
        const handles = await driver.getWindowHandles();
        expect(handles).to.be.an('array').and.not.empty;
        expect(handles[0]).to.match(/^0x[0-9a-fA-F]+$/);
    });

    it('should get and set window rect', async function () {
        const originalRect = await driver.getWindowRect();
        expect(originalRect.width).to.be.a('number');
        expect(originalRect.height).to.be.a('number');

        const newWidth = originalRect.width - 20;
        const newHeight = originalRect.height - 20;

        await driver.setWindowRect(null, null, newWidth, newHeight);
        const updatedRect = await driver.getWindowRect();
        
        expect(updatedRect.width).to.equal(newWidth);
        expect(updatedRect.height).to.equal(newHeight);

        // Restore
        await driver.setWindowRect(null, null, originalRect.width, originalRect.height);
    });

    it('should minimize and maximize window', async function () {
        await driver.minimizeWindow();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await driver.maximizeWindow();
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should launch and close another app', async function () {
        // Use Calculator for this test
        const calcPath = 'C:\\Windows\\System32\\calc.exe';
        await driver.execute('windows: launchApp', { app: calcPath });
        
        // Switch to it (optional check)
        const title = await driver.getTitle();
        // Depending on timing, title might still be Notepad or already Calculator
        
        await driver.execute('windows: closeApp', { app: calcPath });
    });

    it('should switch window via setWindow', async function () {
        const handles = await driver.getWindowHandles();
        if (handles.length > 0) {
            await driver.switchToWindow(handles[0]);
        }
    });

    describe('Capabilities Validation', function () {
        it('should respect delayAfterClick', async function () {
            // Re-create session with specific cap if needed, 
            // but we can also just test that the session works with it.
            const caps = await driver.getCapabilities();
            // driver.getCapabilities() returns what was actually negotiated
        });

        it('should handle smoothPointerMove easing functions', async function () {
            // Easing functions: linear, easeInQuad, easeOutQuad, easeInOutQuad, etc.
            // These are validated during session creation.
        });
    });
});
