const webdriver = require('webdriverio');
const fs = require('fs');

const opts = {
    hostname: '192.168.8.245',
    port: 4723,
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
    },
    logLevel: 'debug',
};

(async () => {
    const driver = await webdriver.remote(opts);
    try {
        // Sent ESC key to close Start Menu if it's open
        await driver.executeScript('windows: keys', [{ actions: [{ virtualKeyCode: 0x1B }] }]);

        const source = await driver.getPageSource();
        console.log(source.length);
        fs.writeFileSync('source_with_taskbar.xml', source);

        const startBtns = await driver.$$("//Pane[@ClassName='Shell_TrayWnd']/Button[@Name='Start']");
        console.log(startBtns.length);

        
    } catch (e) {
        console.error(e);
    } finally {
        await driver.deleteSession();
    }
})();