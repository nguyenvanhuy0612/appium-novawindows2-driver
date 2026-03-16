
const wdio = require('webdriverio');

const opts = {
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:app': 'none', // Use 'none' to trigger the null root element
    },
};

async function main() {
    const client = await wdio.remote(opts);
    try {
        // This should trigger the error because $rootElement is null
        const root = await client.$('//*');
        console.log(await root.getText());
    } catch (e) {
        console.error('Caught expected error:', e);
    } finally {
        await client.deleteSession();
    }
}

main();
