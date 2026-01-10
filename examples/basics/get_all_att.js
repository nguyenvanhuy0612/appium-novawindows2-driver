const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '192.168.1.18',
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
        const attrs = JSON.parse(allAttributes);
        console.log(attrs);

        console.log("\n--- Method 2: mobile: getAttributes ---");
        const mobileAttributes = await driver.executeScript("windows: getAttributes", [element]);
        console.log(JSON.parse(mobileAttributes));

        const attKeys = Object.keys(attrs);
        console.log(`\n\nAttributes Keys: ${attKeys}`);
        for (const attKey of attKeys) {
            const attrValue = await element.getAttribute(attKey);
            console.log(`${attKey}: ${attrValue}`);
        }

    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        await driver.deleteSession();
    }
}

main();
