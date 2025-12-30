const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: 'localhost',
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
        const source = await driver.getPageSource();
        console.log("Source:", source);

        const element = await driver.$("//Window");

        console.log("--- Method 1: getAttribute('all') ---");
        const allAttributes = await element.getAttribute("all");
        console.log(allAttributes);

        console.log("\n--- Method 2: mobile: getAttributes ---");
        const mobileAttributes = await driver.executeScript("windows: getAttributes", [element]);
        console.log(mobileAttributes);

        const parsed = JSON.parse(allAttributes);
        const keyCount = Object.keys(parsed).length;
        console.log(`\nParsed ${keyCount} keys:`, Object.keys(parsed).join(', '));

        if (keyCount >= 60) {
            console.log(`SUCCESS: Retrieved ${keyCount} attributes.`);
        } else {
            console.log(`WARNING: Only retrieved ${keyCount} attributes. Expected around 67.`);
        }

        const legacyName = await element.getAttribute("LegacyName");
        console.log("LegacyName:", legacyName);

        const dottedLegacyName = await element.getAttribute("LegacyIAccessible.Name");
        console.log("LegacyIAccessible.Name:", dottedLegacyName);

        const canMaximize = await element.getAttribute("CanMaximize");
        console.log("canMaximize:", canMaximize);

        const dottedCanMaximize = await element.getAttribute("Window.CanMaximize");
        console.log("Window.CanMaximize:", dottedCanMaximize);

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await driver.deleteSession();
    }
}

main();
