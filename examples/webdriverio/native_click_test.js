
const { NovaWindows2Driver } = require('../../build/lib/driver');

async function main() {
    console.log("Starting Native Click Test...");

    // Create Driver
    const driver = new NovaWindows2Driver();
    const caps = {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:deviceName': 'WindowsPC',
        'appium:app': 'Root',
        'appium:useNativeUia': true
    };

    try {
        console.log("Creating Session...");
        const [sessionId] = await driver.createSession(caps, undefined, undefined, []);
        console.log(`Session Created: ${sessionId}`);

        console.log("Finding 'Taskbar'...");
        const el = await driver.findElement("name", "Taskbar");
        console.log(`Found Element: ${JSON.stringify(el)}`);

        const elementId = Object.values(el)[0];
        if (!elementId.startsWith("NATIVE_")) {
            throw new Error("Element ID is not native!");
        }

        console.log("Getting Element Rect...");
        const rect = await driver.getElementRect(elementId);
        console.log(`Rect: ${JSON.stringify(rect)}`);

        console.log("Clicking Element (should focus and click center)...");
        // This might activate the start menu or taskbar context? 
        // Just verify it doesn't crash.
        await driver.click(elementId);
        console.log("Click Command Executed Successfully.");

        await driver.deleteSession(sessionId);
        console.log("Session Deleted.");

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

main();
