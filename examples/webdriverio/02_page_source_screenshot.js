const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- 02_page_source_screenshot.js (Enhanced) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245'
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
        console.log('3. Taking element screenshot (Start button)...');
        try {
            const startBtn = await driver.$('//*[@Name="Start"]');
            await startBtn.saveScreenshot('screenshot_element2.png');
            console.log(`   Saved element screenshot to: screenshot_element2.png`);
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
