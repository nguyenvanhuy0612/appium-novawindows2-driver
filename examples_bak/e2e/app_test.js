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
            "appium:app": "C:\\Windows\\System32\\notepad.exe",
            "appium:newCommandTimeout": 300
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        await sleep(5000);

        const elements = await client.$$("//*");
        console.log(`Found ${elements.length} elements.`);

        for (const element of elements) {
            console.log(`Element: ${await element.getAttribute('all')}`);
        }

    } catch (e) {
        console.error('Failed to launch Explorer:', e);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();