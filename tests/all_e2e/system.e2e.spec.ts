import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — Clipboard, Files & System', function () {
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

    it('should set and get clipboard text', async function () {
        const text = 'Appium Clipboard Test';
        await driver.setClipboard(Buffer.from(text).toString('base64'), 'plaintext');
        const retrieved = await driver.getClipboard('plaintext');
        expect(Buffer.from(retrieved, 'base64').toString()).to.equal(text);
    });

    it('should set and get image clipboard', async function () {
        // Small 1x1 red PNG pixel
        const redPixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        await driver.execute('windows: setClipboard', { b64Content: redPixel, contentType: 'image' });
        const retrieved = await driver.execute('windows: getClipboard', { contentType: 'image' });
        expect(retrieved).to.be.a('string').and.not.empty;
    });

    it('should push and pull a file', async function () {
        const remotePath = 'C:\\Users\\Public\\appium_test.txt';
        const content = 'Hello from Appium';
        const base64Content = Buffer.from(content).toString('base64');
        
        await driver.pushFile(remotePath, base64Content);
        const pulled = await driver.pullFile(remotePath);
        
        expect(pulled).to.equal(base64Content);
    });

    it('should pull a folder as zip', async function () {
        // Pull something that definitely exists
        const remotePath = 'C:\\Users\\Public\\Documents';
        const zip = await driver.pullFolder(remotePath);
        expect(zip).to.be.a('string').and.not.empty;
    });

    it('should get device orientation', async function () {
        const orientation = await driver.getOrientation();
        expect(['PORTRAIT', 'LANDSCAPE']).to.contain(orientation);
    });
});
