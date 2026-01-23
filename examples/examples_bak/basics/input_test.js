const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        // hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:typeDelay": 1000
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        const element = await driver.$("//Document[@Name='Text Editor']");
        await element.setValue("HelloHelloHelloHelloHelloHelloHelloHello");
        
    } catch (error) {
        console.error(error);
    } finally {
        await driver.deleteSession();
    }
}

main();