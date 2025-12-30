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
        const listItem = await driver.$("//Window[contains(@Name,'Migration Tool')]/List/ListItem[@Name='a']");

        console.log('Found element, executing scrollIntoView...');
        await driver.execute('windows: scrollIntoView', listItem);
        console.log('scrollIntoView executed.');

        await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
        console.error('Error in test script:', e.message);
    } finally {
        await driver.deleteSession();
    }
}

main();
