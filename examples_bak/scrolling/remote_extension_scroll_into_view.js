const { remote } = require('webdriverio');

/**
 * Remote Integration Test for ALL Extension Commands
 * Sequence matches EXTENSION_COMMANDS in lib/commands/extension.ts
 */
const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        // hostname: 'localhost',
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
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        // Quit open Explorer and open new one
        await client.execute('powerShell', '(New-Object -ComObject Shell.Application).Windows() | ForEach-Object { $_.Quit() }');
        await client.execute('powerShell', 'Start-Process explorer "C:\\Windows"');
        await new Promise(r => setTimeout(r, 5000));

        // Test scrollIntoView (Pattern)
        console.log('\nTesting scrollIntoView...');
        // Check open windows
        const titles = await client.execute('powerShell', 'Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle');
        console.log('All Open Windows:', titles);

        // Search for ListItem directly
        console.log('Searching for ListItem directly...');
        const explorer = await client.$("//List/ListItem[1]");
        const explorerId = await explorer[W3C_ELEMENT_KEY];
        console.log(`Explorer ID: ${explorerId}`);

        // Debug: check existence
        const exists = await client.execute('powerShell', `$elementTable.ContainsKey('${explorerId}')`);
        console.log(`Element in table: ${exists}`);

        // Debug: check patterns
        const patterns = await client.execute('powerShell', `
            $el = $elementTable['${explorerId}'];
            $el.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName }
        `);
        console.log(`Supported Patterns: ${patterns}`);

        await client.execute('windows:scrollIntoView', { elementId: explorerId });
        console.log('Scrolled Editor into view.');

    } catch (err) {
        console.error('CRITICAL TEST FAILURE:', err);
    } finally {
        if (client) {
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
