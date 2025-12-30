
const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '127.0.0.1',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 3600,
            "appium:useNativeUia": true
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting to Appium...');
        client = await remote(opts);
        console.log('Connected.');

        console.log("Finding '//Window' via Native UIA...");
        // This corresponds to ControlType.Window (50032) in my custom driver logic
        let window = await client.$("//Button");
        console.log('Found window object.');

        const w3cKey = 'element-6066-11e4-a52e-4f735466cecf';
        const elementId = window.elementId;
        const w3cId = window[w3cKey];

        console.log(`window.elementId: ${elementId}`);

        if (!elementId.startsWith("NATIVE_")) {
            throw new Error("Element ID does not start with NATIVE_! Feature not working.");
        }

        console.log("SUCCESS: Native Element Found via XPath!");

    } catch (err) {
        console.error('FAILURE:', err);
    } finally {
        if (client) {
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
