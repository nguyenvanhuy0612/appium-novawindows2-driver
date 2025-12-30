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
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        const elements = await driver.$$("//*");
        for (const element of elements) {
            const attName = await element.getAttribute("Name");
            console.log(`Element Name: ${attName}`);
        }
    } catch (error) {
        console.error(error);
    } finally {
        await driver.deleteSession();
    }
}

main();