const { remote } = require('webdriverio');

const capabilities = {
    platformName: 'Windows',
    'appium:automationName': 'NovaWindows2',
    'appium:app': 'Root',
    'appium:useNativeUia': true,
};

const wdioOpts = {
    hostname: 'localhost',
    port: 4723,
    capabilities,
};

const findElement = async (driver, xpath) => {
    try {
        const element = await driver.$(xpath);
        if (await element.isExisting()) {
            console.log(`Element found: ${xpath}`);
            console.log(`Element Name: ${await element.getAttribute('Name')}`);
            return element;
        } else {
            console.log(`Element not found: ${xpath}`);
            return null;
        }
    } catch (error) {
        console.error(`Error finding element: ${xpath}`, error);
        return null;
    }
};

async function runTest() {
    const driver = await remote(wdioOpts);
    try {
        console.log('--- NATIVE XPATH DEEP CHECK ---');

        // Test 1: Absolute Path + Attribute
        console.log('Testing Absolute Path + Attribute: /Pane[@Name="Taskbar"]');
        await findElement(driver, '/Pane[@Name="Taskbar"]');

        // Test 2: Double Slash + Attribute (Deep)
        console.log('Testing Double Slash + Attribute: //Button[@Name="Start"]');
        await findElement(driver, '//Button[@Name="Start"]');

        // Test 3: Wildcard + Attribute
        console.log('Testing Wildcard + Attribute: //*[@AutomationId="StartBadge"]');
        await findElement(driver, '//*[@AutomationId="StartBadge"]');

        // Test 4: Position/Index
        console.log('Testing Index: //Button[1]');
        await findElement(driver, '//Button[1]');

        // Test 5: Complex Hierarchy
        console.log('Testing Complex Hierarchy: /Pane[@Name="Taskbar"]//Button[1]');
        await findElement(driver, '/Pane[@Name="Taskbar"]//Button[1]');

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await driver.deleteSession();
    }
}

runTest();
