const { remote } = require('webdriverio');
const util = require('util');

async function main() {
    const opts = {
        hostname: '127.0.0.1',
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

        // Launch Notepad
        try { await client.execute('powerShell', 'taskkill /f /im notepad.exe') } catch (e) { }
        await client.execute('powerShell', 'Start-Process notepad');
        await new Promise(r => setTimeout(r, 2000));

        console.log('Finding Notepad...');
        let window = await client.$("//Window[@ClassName='Notepad']");

        console.log('--- ELEMENT INSPECTION ---');
        console.log('Type of window:', typeof window);
        console.log('Is Promise?', window instanceof Promise);
        console.log('Constructor:', window.constructor.name);

        console.log('Keys:', Object.keys(window));
        console.log('elementId prop:', window.elementId);
        console.log('W3C ID prop:', window['element-6066-11e4-a52e-4f735466cecf']);
        console.log('elementId attribute (via getAttribute):', await window.getAttribute('elementId').catch(e => 'N/A'));

        console.log('Full Object:', util.inspect(window, { depth: 1, colors: false }));

        console.log('Checking "explorer" (assuming it fails or works)...');
        // Let's try to find explorer specifically as in user script
        try {
            // Use a known existing element instead of explorer if explorer is tricky
            // But user used //*[@Name='explorer.exe'] - let's try that
            const explorer = await client.$("//*[@Name='explorer.exe']");
            console.log('Explorer found:', !!explorer);
            console.log('Explorer elementId:', explorer.elementId);
        } catch (e) {
            console.log('Explorer lookup failed:', e.message);
        }

    } catch (err) {
        console.error('FAILURE:', err);
    } finally {
        if (client) await client.deleteSession();
    }
}
main();
