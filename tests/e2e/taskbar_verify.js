const webdriver = require('webdriverio');

const opts = {
    hostname: '192.168.8.245',
    port: 4723,
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
        'appium:newCommandTimeout': 300,
    },
    logLevel: 'debug',
};

(async () => {
    const driver = await webdriver.remote(opts);

    try {
        // Send ESC key to close any open windows
        await driver.executeScript('windows: keys', [{ actions: [{ virtualKeyCode: 27 }] }]);

        // 1. Find Start Button
        const startLocator = "//Pane[@ClassName='Shell_TrayWnd']//Button[@Name='Start']";
        let startBtn = await driver.$(startLocator);
        console.log('Start Button found:', await startBtn.isDisplayed());
        // 2. Click Start Button
        await startBtn.click();
        // 3. Find Start Button Again
        startBtn = await driver.$(startLocator);
        console.log('Start Button found:', await startBtn.isDisplayed());

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        await driver.deleteSession();
    }
})();
