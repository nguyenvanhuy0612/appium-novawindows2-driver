const wdio = require('webdriverio');

const opts = {
    hostname: '172.16.1.52',
    port: 4723,
    path: '/',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
    }
};

async function main() {
    const driver = await wdio.remote(opts);
    try {
        const source = await driver.getPageSource();
        console.log(source);
    } catch (e) {
        console.error('Error getting source:', e);
    } finally {
        await driver.deleteSession();
    }
}

main();
