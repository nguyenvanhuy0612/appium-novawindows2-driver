const { remote } = require('webdriverio');

async function main() {
    const wdioOpts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root',
        },
        logLevel: 'error'
    };

    const driver = await remote(wdioOpts);
    const rootElement = await driver.findElement('xpath', '//*');
    console.log('Root element:', rootElement);
    await driver.quit();
}

main().catch(console.error);