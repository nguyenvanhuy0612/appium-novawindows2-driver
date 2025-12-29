const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 120,
            "appium:includeContextElementInSearch": false
        },
        logLevel: 'error'
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

        // --- Test: Element in Element ---
        console.log('\n[Test] Element in Element...');
        let explorerWindow;
        try {
            explorerWindow = await client.$('//Window[@ClassName="CabinetWClass"]');
        } catch (e) {
            console.error('Failed to find explorer window:', e);
        }

        try {
            const element = await explorerWindow.$('.//Window[@ClassName="CabinetWClass"]/Pane[@Name="Desktop"]')
            console.log(`Element: ${await element.getAttribute('Name')}`);
        } catch (e) {
            console.error('Failed to find element:', e);
        }

        try {
            const element2 = await explorerWindow.$('./Pane[@Name="Desktop"]')
            console.log(`Element2: ${await element2.getAttribute('Name')}`);
        } catch (e) {
            console.error('Failed to find element2:', e);
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