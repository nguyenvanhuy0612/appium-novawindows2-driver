import { remote, type Browser } from 'webdriverio';
import { expect } from 'chai';

const APPIUM_URL = process.env.APPIUM_URL ?? 'http://127.0.0.1:4723';
const TARGET_APP = process.env.TARGET_APP ?? 'C:\\Windows\\System32\\notepad.exe';

const url = new URL(APPIUM_URL);

describe('NovaWindows2 — PowerShell & System Commands', function () {
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

    it('should execute raw PowerShell scripts', async function () {
        const result = await driver.execute('windows: powershell', { script: 'Get-Process -Name notepad | Select-Object -ExpandProperty Id' });
        expect(result).to.match(/^\d+$/);
    });

    it('should get device time', async function () {
        const time = await driver.getDeviceTime();
        expect(time).to.be.a('string').and.not.empty;
    });

    it('should set process foreground', async function () {
        // Get notepad PID
        const pidStr = await driver.execute('windows: powershell', { script: '(Get-Process -Name notepad).Id' });
        const pid = parseInt(pidStr);
        if (pid) {
            await driver.execute('windows: activateProcess', { processId: pid });
        }
    });
});
