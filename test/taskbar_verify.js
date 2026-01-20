const webdriver = require('webdriverio');
const assert = require('assert');

const opts = {
    hostname: '192.168.8.245',
    port: 4723,
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
    },
    logLevel: 'info',
};

(async () => {
    const driver = await webdriver.remote(opts);
    let failures = 0;

    try {
        console.log('--- Taskbar Verification ---');

        // 1. Initial State (Start Closed)
        console.log('Checking for Start Button in CLOSED state...');
        // Use findElement (Singular) to text Find-Descendant fallback
        let startBtn = await driver.$("//Pane[@ClassName='Shell_TrayWnd']//Button[@Name='Start']");
        await startBtn.waitForExist({ timeout: 5000 });
        console.log('Start Button Found (Closed State)');

        // 2. Open Start Menu
        console.log('Opening Start Menu...');
        await startBtn.click();
        await driver.pause(2000);

        // 3. Verify Reachability in OPEN State
        console.log('Checking for Start Button in OPEN state...');

        // Use findElement (Singular) specifically
        // WebdriverIO '$' uses findElement
        startBtn = await driver.$("//Pane[@ClassName='Shell_TrayWnd']//Button[@Name='Start']");

        try {
            // Check if we can interact with it (validating the element is "live")
            const isDisplayed = await startBtn.isDisplayed();
            console.log(`Start Button Displayed: ${isDisplayed}`);

            // Try clicking it again to close menu
            await startBtn.click();
            console.log('Start Button Clicked (Open State) -> Menu Should Close');
        } catch (e) {
            console.error('Failed to interact with Start Button in Open State:', e.message);
            failures++;
        }

    } catch (e) {
        console.error('Test Failed:', e.message);
        failures++;
    } finally {
        await driver.deleteSession();
        console.log(`failures: ${failures}`);
        process.exit(failures > 0 ? 1 : 0);
    }
})();
