const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245',
            capabilities: {
                'appium:app': "C:\\Program Files\\SecureAge\\bin\\SecureAge.exe",
                "appium:automationName": "NovaWindows",
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
        console.log('3. Taking element screenshot (ComboBox button)...');
        try {
            const path = path.resolve(__dirname, 'combobox.png');
            const combobox = await driver.$('//ComboBox');
            await combobox.saveScreenshot(path);
            console.log(`   Saved element screenshot to: ${path}`);
        } catch (e) {
            console.log('   Failed to take element screenshot: ' + e.message);
        }
        try {
            const path = path.resolve(__dirname, 'icon.png');
            const icon = await combobox.$('//Text');
            await icon.saveScreenshot(path);
            console.log(`   Saved element screenshot to: ${path}`);
        } catch (e) {
            console.log('   Failed to take element screenshot: ' + e.message);
        }
        try {
            const path = path.resolve(__dirname, 'dropdown.png');
            const dropdown = await combobox.$('//Button');
            await dropdown.saveScreenshot(path);
            console.log(`   Saved element screenshot to: ${path}`);
        } catch (e) {
            console.log('   Failed to take element screenshot: ' + e.message);
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
