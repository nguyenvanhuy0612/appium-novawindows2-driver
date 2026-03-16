const { remote } = require('webdriverio');

async function click_until_not_found(driver, locators) {
    const delay = 1000;
    const timeout = 60000;
    let startTime = Date.now();
    while (true) {
        const found_any = false;
        for (const locator of locators) {
            console.log(`Checking for locator: ${locator}`);
            const element = await driver.$(locator);
            if (await element.isExisting()) {
                console.log(`Found locator: ${locator}`);
                found_any = true;
                await element.click();
            }
        }
        if (!found_any) {
            console.log('No locators found, returning');
            return;
        }
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for element to be found');
        }
        await sleep(delay);
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const wdioOpts = {
        hostname: '192.168.8.245',
        port: 4723,
        path: '/',
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root',
        },
        logLevel: 'error'
    };
    
    let driver;
    try {
        driver = await remote(wdioOpts);
        const all_locator = [
            "/Window[contains(@Name,'Secure')]/Button[@Name='OK' or @Name='Ok']",
            "/Window[contains(@Name,'Secure') and ./Text[contains(@Name,'cancel the certificate creation')]]/Button[@Name='Yes']",
            "/Window[contains(@Name,'Secure')]/Button[@Name='NO' or @Name='No']",
            "/Window/Window//Button[@Name='Close']",
        ];
        await click_until_not_found(driver, all_locator);
    } catch (error) {
        console.log(error);
    } finally {
        await driver?.deleteSession();
    }
}

main().catch(console.error);