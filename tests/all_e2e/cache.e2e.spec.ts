import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — Cache Optimization (Full Coverage)', function () {
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

    describe('windows: cacheRequest', function () {
        it('should set treeScope by name (Subtree)', async function () {
            await driver.execute('windows: cacheRequest', { treeScope: 'Subtree' });
        });

        it('should set treeScope by numeric flag (4 = Children)', async function () {
            await driver.execute('windows: cacheRequest', { treeScope: 4 });
        });

        it('should set automationElementMode by name (Full)', async function () {
            await driver.execute('windows: cacheRequest', { automationElementMode: 'Full' });
        });

        it('should set automationElementMode by numeric flag (0 = None)', async function () {
            await driver.execute('windows: cacheRequest', { automationElementMode: 0 });
        });

        it('should set treeFilter (condition string)', async function () {
            await driver.execute('windows: cacheRequest', { 
                treeFilter: 'ControlType == "Window" AND Name CONTAINS "Notepad"' 
            });
        });

        it('should set multiple properties at once', async function () {
            await driver.execute('windows: cacheRequest', { 
                treeScope: 'Children',
                automationElementMode: 'Full'
            });
        });

        it('should throw error for invalid treeScope', async function () {
            try {
                await driver.execute('windows: cacheRequest', { treeScope: 'InvalidScope' });
                throw new Error('Should have failed');
            } catch (e: any) {
                expect(e.message).to.contain('Invalid value');
            }
        });
    });
});
