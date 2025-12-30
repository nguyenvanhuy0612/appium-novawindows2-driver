const { remote } = require('webdriverio');

const capabilities = {
    platformName: 'Windows',
    'appium:automationName': 'NovaWindows2',
    'appium:app': 'Root',
    'appium:useNativeUia': true,
};

const wdioOpts = {
    hostname: 'localhost',
    port: 4726,
    capabilities,
};

async function runTest() {
    const driver = await remote(wdioOpts);
    try {
        console.log('--- NATIVE XPATH DEEP CHECK ---');

        // Test 1: Absolute Path + Attribute
        console.log('Testing Absolute Path + Attribute: /Pane[@Name="Taskbar"]');
        const taskbar = await driver.$('/Pane[@Name="Taskbar"]');
        console.log('Taskbar found:', await taskbar.isExisting());

        // Test 2: Double Slash + Attribute (Deep)
        console.log('Testing Double Slash + Attribute: //Button[@Name="Start"]');
        const startButton = await driver.$('//Button[@Name="Start"]');
        console.log('Start Button found:', await startButton.isExisting());
        if (await startButton.isExisting()) {
            console.log('Start Button Name:', await startButton.getAttribute('Name'));
        }

        // Test 3: Wildcard + Attribute
        console.log('Testing Wildcard + Attribute: //*[@AutomationId="StartBadge"]');
        const startBadge = await driver.$('//*[@AutomationId="StartBadge"]');
        console.log('Start Badge found:', await startBadge.isExisting());

        // Test 4: Position/Index
        console.log('Testing Index: //Button[1]');
        const firstButton = await driver.$('//Button[1]');
        console.log('First Button found:', await firstButton.isExisting());
        if (await firstButton.isExisting()) {
            console.log('First Button Name:', await firstButton.getAttribute('Name'));
        }

        // Test 5: Complex Hierarchy
        console.log('Testing Complex Hierarchy: /Pane[@Name="Taskbar"]//Button[1]');
        const complex = await driver.$('/Pane[@Name="Taskbar"]//Button[1]');
        console.log('Complex result found:', await complex.isExisting());
        if (await complex.isExisting()) {
            console.log('Complex result Name:', await complex.getAttribute('Name'));
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await driver.deleteSession();
    }
}

runTest();
