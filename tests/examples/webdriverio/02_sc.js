const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- 02_page_source_screenshot.js (Enhanced) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows',
                'appium:app': "C:\\Windows\\explorer.exe"
            }
        });

        // 1. Get Page Source (XML)
        console.log('1. Getting page source...');
        const source = await driver.getPageSource();
        console.log(`   Page source length: ${source.length} characters`);

        // Save source to file for inspection
        const sourcePath = path.resolve(__dirname, 'source_dump.xml');
        fs.writeFileSync(sourcePath, source);
        console.log(`   Saved page source to: ${sourcePath}`);

        // 2. Take Screenshot (Full Page)
        console.log('2. Taking full page screenshot...');
        const screenshotBase64 = await driver.takeScreenshot();
        const screenPath = path.resolve(__dirname, 'screenshot_full.png');
        fs.writeFileSync(screenPath, screenshotBase64, 'base64');
        console.log(`   Saved full screenshot to: ${screenPath}`);

        // 3. Element Screenshot
        console.log('3. Taking element screenshot (minimize button)...');
        try {
            const screenPath = path.resolve(__dirname, 'screenshot_element.png');
            const toolBar = await driver.$('/Window/Pane[1]/Pane');
            await toolBar.saveScreenshot(screenPath);
            console.log(`   Saved element screenshot to: ${screenPath}`);
        } catch (e) {
            console.log('   Failed to take element screenshot: ' + e.message);
        }

        // 4. element in element screenshot
        console.log('4. Taking element in element screenshot (minimize button)...');
        try {
            const screenPath = path.resolve(__dirname, 'screenshot_element_in_element.png');
            const toolBar = await driver.$('/Window/Pane[1]/Pane');
            const minimizeBtn = await toolBar.$('//Button[@Name="Minimize the Ribbon"]');
            await minimizeBtn.saveScreenshot(screenPath);
            console.log(`   Saved element in element screenshot to: ${screenPath}`);
        } catch (e) {
            console.log('   Failed to take element in element screenshot: ' + e.message);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
