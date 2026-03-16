const wdio = require('webdriverio');

const opts = {
    hostname: '172.16.1.53',
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

        const allElements = await driver.$$('//*');
        console.log('Found', allElements.length, 'elements');

        for (const element of allElements) {
            const name = await element.getAttribute('Name');
            console.log(`Element name: ${name}`);
        }

    } catch (e) {
        console.error('Error getting source:', e);
    } finally {
        await driver.deleteSession();
    }
}

main();
