
import { NovaWindows2Driver } from '../../lib/driver';
// import { UIAClient } from '../../lib/winapi/uia';
import * as os from 'os';

async function main() {
    console.log("Starting Capabilities Test...");

    const caps = {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:deviceName': 'WindowsPC',
        'appium:app': 'Root', // Use Root to avoid launching new app
        'appium:useNativeUia': true // ENABLE NATIVE UIA
    };

    console.log("Creating Driver instance...");
    try {
        const driver = new NovaWindows2Driver();
        console.log("Driver Created.");

        console.log("Creating Session...");
        // This might fail if Appium BaseDriver dependencies are tricky in isolation
        // But let's try.
        const [sessionId, resCaps] = await driver.createSession(caps as any, undefined, undefined, []);
        console.log("Session Created:", sessionId);

        if (driver.uiaClient) {
            console.log("SUCCESS: uiaClient is initialized!");
        } else {
            console.error("FAILURE: uiaClient is NOT initialized.");
        }

        console.log("Finding 'Taskbar' by Name (Native)...");
        try {
            const el = await driver.findElement("name", "Taskbar");
            console.log("Found Element:", el);
            // Verify ID format
            const key = Object.keys(el)[0];
            const id = el[key];
            console.log(`Element ID: ${id}`);

            if (id && id.startsWith("NATIVE_")) {
                console.log("SUCCESS: Element ID indicates Native UIA!");
            } else {
                console.log("WARNING: Element ID does not look Native.");
            }
        } catch (e) {
            console.error("FindElement Failed:", e);
        }

        console.log("Deleting Session...");
        await driver.deleteSession(sessionId);

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

main();
