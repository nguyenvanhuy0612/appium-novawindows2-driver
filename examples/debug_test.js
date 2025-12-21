const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '127.0.0.1',
        port: 4723,
        path: '/',
        capabilities: {
            "platformName": "Windows",
            "appium:automationName": "NovaWindows2",
            "appium:app": "Root",
            "appium:isolatedScriptExecution": false,
            "appium:newCommandTimeout": 60
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting...');
        client = await remote(opts);
        console.log('Connected.');
        console.log('Sending Get-Date...');
        const startTime = Date.now();
        try {
            const res = await client.executeScript('powerShell', ['Get-Date; exit 0;']);
            console.log('Result:', res);
        } catch (e) {
            console.error('Error:', e);
        } finally {
            console.log('Time taken:', Date.now() - startTime);
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (client) {
            console.log('Deleting session...');
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
