const { remote } = require('webdriverio');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:typeDelay": 0 // Start with 0 delay
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        const element = await driver.$("//Document[@Name='Text Editor']");

        console.log("1. Typing with default configured delay (0ms) - Should be fast");
        await element.setValue(""); // Focus
        await element.addValue("FastText_");
        await sleep(1000);

        console.log("2. Setting global delay using extension (testing various formats)");
        await driver.execute('windows: typeDelay', { delay: 500 });
        await driver.execute('windows: typeDelay', { delay: '500' });
        await driver.execute('windows: typeDelay', 500);
        await driver.execute('windows: typeDelay', '500');

        console.log("   Typing... (should be slow)");
        await element.addValue("SlowText_");
        await sleep(1000);

        console.log("3. Using inline delay [delay:10] override - Should be fast");
        // Note: The inline delay only applies to this specific action
        await element.addValue("[delay:10]FastInline_");
        await sleep(1000);

        console.log("4. Verifying global delay (500ms) persists after inline action - Should be slow again");
        await element.addValue("SlowAgain_");

    } catch (error) {
        console.error(error);
    } finally {
        await driver.deleteSession();
    }
}

main();
