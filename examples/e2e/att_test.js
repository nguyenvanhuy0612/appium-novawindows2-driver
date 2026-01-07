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

        const element = await client.$('//*[@Name="SecureAge - Directory Search - sec.com"]/ComboBox')
        console.log(element)
        const atts = await element.getAttribute('all')
        console.log(JSON.stringify(JSON.parse(atts), null, 2));


        const legacy_value_long = await element.getAttribute('LegacyIAccessible.Value')
        console.log(`legacy_value_long: ${legacy_value_long}`)

        const legacy_name_long = await element.getAttribute('LegacyIAccessible.Name')
        console.log(`legacy_name_long: ${legacy_name_long}`)

        const legacy_value = await element.getAttribute('LegacyValue')
        console.log(`legacy_value: ${legacy_value}`)

        const legacy_name = await element.getAttribute('LegacyName')
        console.log(`legacy_name: ${legacy_name}`)

    } catch (e) {
        console.error('Failed to launch Explorer:', e);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();