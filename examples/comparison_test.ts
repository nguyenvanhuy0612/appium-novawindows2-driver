
import { NovaWindows2Driver } from '../lib/driver';
import * as os from 'os';

async function runSession(useNative: boolean) {
    console.log(`\n--- Running Session with Native UIA: ${useNative} ---`);
    const caps = {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:deviceName': 'WindowsPC',
        'appium:app': 'Root',
        'appium:useNativeUia': useNative
    };

    const driver = new NovaWindows2Driver();
    const [sessionId] = await driver.createSession(caps as any, undefined, undefined, []);

    const start = process.hrtime();
    console.log("Finding 'Taskbar'...");

    try {
        const el = await driver.findElement("name", "Taskbar");
        const end = process.hrtime(start);
        const timeInMs = (end[0] * 1000 + end[1] / 1e6).toFixed(2);

        console.log(`Found Element: ${JSON.stringify(el)}`);
        console.log(`Time taken: ${timeInMs} ms`);

    } catch (e) {
        console.error("Find Failed:", e);
    }

    await driver.deleteSession(sessionId);
}

async function main() {
    try {
        // Run Native First
        await runSession(true);

        // Run PowerShell Second
        await runSession(false);

    } catch (e) {
        console.error("Test Error:", e);
    }
}

main();
