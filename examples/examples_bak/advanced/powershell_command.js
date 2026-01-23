const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '192.168.8.245',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 120
        },
        logLevel: 'info'
    };

    let client;
    try {
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        // --- Setup: Launch Explorer ---
        console.log('\n[Setup] Launching Explorer...');
        await client.execute('powerShell', 'Invoke-Item "C:\\Users\\admin\\Desktop"');
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.error('Failed to launch Explorer:', e);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();
