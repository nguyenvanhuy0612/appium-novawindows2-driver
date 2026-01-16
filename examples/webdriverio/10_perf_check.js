const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- 02_page_source_screenshot.js (Enhanced) ---');
    let driver;
    const timeFunc = async (func) => {
        const startTime = Date.now();
        try {
            const result = await func();
            const endTime = Date.now();
            console.log(`Time taken: ${endTime - startTime}ms`);
            return result;
        } catch (error) {
            const endTime = Date.now();
            console.log(`Time taken: ${endTime - startTime}ms`);
            throw error;
        }
    }
    try {
        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows',
                'appium:app': "C:\\Windows\\explorer.exe"
            }
        });

        // 1. Find Button1 with NovaWindows
        console.log('1. Finding button1...');
        const button = await timeFunc(() => driver.$('/Window/Pane[1]/Pane/Pane/Pane/Pane/ToolBar/Button[1]'));
        console.log(`   Button1 found:`);
        console.log(button);

        await driver.deleteSession();

        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows2',
                'appium:app': "C:\\Windows\\explorer.exe"
            }
        });

        // 2. Find Button1 with NovaWindows2
        console.log('2. Finding button2...');
        const button2 = await timeFunc(() => driver.$('/Window/Pane[1]/Pane/Pane/Pane/Pane/ToolBar/Button[1]'));
        console.log(`   Button2 found:`);
        console.log(button2);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
