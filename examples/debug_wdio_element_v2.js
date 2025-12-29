const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 3600
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting...');
        client = await remote(opts);
        console.log('Connected.');

        console.log('Finding first Window...');
        // Find any window
        let window = await client.$("//Window");
        console.log('Found window.');

        const w3cKey = 'element-6066-11e4-a52e-4f735466cecf';
        const elementId = window.elementId;
        const w3cId = window[w3cKey];

        console.log(`window.elementId: ${elementId}`);
        console.log(`window['${w3cKey}']: ${w3cId}`);
        console.log('Object.keys(window):', Object.keys(window));

        // Also check if there's a getter on prototype
        // console.log('Prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(window)));

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
