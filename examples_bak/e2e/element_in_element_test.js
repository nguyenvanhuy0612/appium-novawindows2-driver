const { remote } = require('webdriverio');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const opts = {
        hostname: '192.168.9.91',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 300
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        const window = await client.$("//Window[contains(@Name,'SecureAge - Directory Search')]");
        console.log(window);

        const all = await window.$$("//*")
        for (const element of all) {
            console.log(`Element Tag: ${await element.getTagName()}`)
        }

        const elements = await window.$$(".//ListItem");
        console.log(`Found ${elements.length} elements.`);

    } catch (e) {
        console.error('Failed to launch Explorer:', e);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();