
const { NovaWindows2Driver } = require('../../build/lib/driver');
const { performance } = require('perf_hooks');

async function runSession(useNative) {
    console.log(`\n--- Running Session with Native UIA: ${useNative} ---`);
    const caps = {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:deviceName': 'WindowsPC',
        'appium:app': 'Root',
        'appium:useNativeUia': useNative
    };

    console.log("Instantiating driver...");
    const driver = new NovaWindows2Driver();
    console.log("Driver instantiated. Creating session...");

    // createSession returns [sessionId, caps]
    const [sessionId] = await driver.createSession(caps, undefined, undefined, []);
    console.log(`Session created: ${sessionId}`);

    const start = performance.now();
    console.log("Finding 'Taskbar'...");

    try {
        const el = await driver.findElement("name", "Taskbar");
        const end = performance.now();
        const timeInMs = (end - start).toFixed(2);

        console.log(`Found Element: ${JSON.stringify(el)}`);
        console.log(`Time taken: ${timeInMs} ms`);

        // Basic check if ID is native (checking format)
        const id = Object.values(el)[0];
        if (useNative) {
            if (id.startsWith("NATIVE_")) console.log("SUCCESS: ID confirms Native implementation.");
            else console.error("FAILURE: Expected Native ID but got: " + id);
        } else {
            if (!id.startsWith("NATIVE_")) console.log("SUCCESS: ID confirms PowerShell implementation.");
            else console.error("FAILURE: Expected PowerShell ID but got Native one.");
        }

    } catch (e) {
        console.error("Find Failed:", e);
    }

    console.log("Deleting session...");
    await driver.deleteSession(sessionId);
    console.log("Session deleted.");
}

async function main() {
    try {
        // Run Native First
        await runSession(true);

        // Wait a bit to ensure cleanup
        await new Promise(r => setTimeout(r, 2000));

        // Run PowerShell Second
        await runSession(false);

    } catch (e) {
        console.error("Test Error:", e);
    }
}

main();
