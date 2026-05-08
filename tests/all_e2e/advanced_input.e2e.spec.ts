import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — Advanced Input Extensions (Full Coverage)', function () {
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

    describe('windows: click', function () {
        it('should click element center', async function () {
            const el = await driver.$('//Document | //Edit');
            await driver.execute('windows: click', { elementId: el.elementId });
        });

        it('should click element with offset', async function () {
            const el = await driver.$('//Document | //Edit');
            await driver.execute('windows: click', { elementId: el.elementId, x: 10, y: 10 });
        });

        it('should click absolute coordinates', async function () {
            await driver.execute('windows: click', { x: 100, y: 100 });
        });

        it('should click current position (no args)', async function () {
            await driver.execute('windows: click', {});
        });

        it('should right click', async function () {
            await driver.execute('windows: click', { button: 'right' });
        });

        it('should click with modifiers (Shift)', async function () {
            await driver.execute('windows: click', { modifierKeys: ['shift'] });
        });

        it('should double click', async function () {
            await driver.execute('windows: click', { times: 2, interClickDelayMs: 50 });
        });

        it('should click with duration (long press)', async function () {
            await driver.execute('windows: click', { durationMs: 500 });
        });
    });

    describe('windows: hover', function () {
        it('should hover element center', async function () {
            const el = await driver.$('//Document | //Edit');
            await driver.execute('windows: hover', { startElementId: el.elementId });
        });

        it('should hover with absolute coordinates', async function () {
            await driver.execute('windows: hover', { startX: 200, startY: 200 });
        });

        it('should hover from start element to end element', async function () {
            const editor = await driver.$('//Document | //Edit');
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: hover', { 
                    startElementId: editor.elementId, 
                    endElementId: titleBar.elementId,
                    durationMs: 1000 
                });
            }
        });

        it('should hover with start element offset', async function () {
            const editor = await driver.$('//Document | //Edit');
            await driver.execute('windows: hover', { 
                startElementId: editor.elementId,
                startX: 10,
                startY: 10
            });
        });

        it('should hover from element to absolute coordinate', async function () {
            const editor = await driver.$('//Document | //Edit');
            await driver.execute('windows: hover', { 
                startElementId: editor.elementId, 
                endX: 300,
                endY: 300
            });
        });

        it('should hover from absolute coordinate to element', async function () {
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: hover', { 
                    startX: 10, startY: 10,
                    endElementId: titleBar.elementId
                });
            }
        });
    });

    describe('windows: scroll', function () {
        it('should scroll vertically (deltaY)', async function () {
            await driver.execute('windows: scroll', { deltaY: 120 });
        });

        it('should scroll horizontally (deltaX)', async function () {
            await driver.execute('windows: scroll', { deltaX: 120 });
        });

        it('should scroll at specific element location', async function () {
            const el = await driver.$('//Document | //Edit');
            await driver.execute('windows: scroll', { elementId: el.elementId, deltaY: -120 });
        });
    });

    describe('windows: keys', function () {
        it('should send virtual key codes', async function () {
            // VK_A = 0x41
            await driver.execute('windows: keys', { 
                actions: [
                    { virtualKeyCode: 0x41, down: true }, 
                    { virtualKeyCode: 0x41, down: false }
                ] 
            });
        });

        it('should send text sequence', async function () {
            await driver.execute('windows: keys', { 
                actions: [{ text: 'Appium' }] 
            });
        });

        it('should include pauses between keys', async function () {
            await driver.execute('windows: keys', { 
                actions: [
                    { text: 'A' }, 
                    { pause: 100 }, 
                    { text: 'B' }
                ] 
            });
        });
    });

    describe('windows: clickAndDrag', function () {
        it('should drag from element to element', async function () {
            const editor = await driver.$('//Document | //Edit');
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: clickAndDrag', {
                    startElementId: editor.elementId,
                    endElementId: titleBar.elementId,
                    durationMs: 500
                });
            }
        });

        it('should drag from element with offset to element with offset', async function () {
            const editor = await driver.$('//Document | //Edit');
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: clickAndDrag', {
                    startElementId: editor.elementId,
                    startX: 5, startY: 5,
                    endElementId: titleBar.elementId,
                    endX: 10, endY: 10
                });
            }
        });

        it('should drag between coordinates', async function () {
            await driver.execute('windows: clickAndDrag', {
                startX: 100, startY: 100,
                endX: 200, endY: 200,
                durationMs: 500
            });
        });

        it('should drag from coordinate to element', async function () {
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: clickAndDrag', {
                    startX: 100, startY: 100,
                    endElementId: titleBar.elementId
                });
            }
        });

        it('should drag from element to coordinate', async function () {
            const editor = await driver.$('//Document | //Edit');
            await driver.execute('windows: clickAndDrag', {
                startElementId: editor.elementId,
                endX: 300, endY: 300
            });
        });

        it('should drag from current cursor position to element', async function () {
            const titleBar = await driver.$('~TitleBar');
            if (await titleBar.isExisting()) {
                await driver.execute('windows: clickAndDrag', {
                    endElementId: titleBar.elementId
                });
            }
        });
    });
});
