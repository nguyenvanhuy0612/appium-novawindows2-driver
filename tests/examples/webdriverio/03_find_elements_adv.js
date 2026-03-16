const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:deviceName': 'WindowsPC',
                'appium:app': "C:\\Windows\\explorer.exe"
            }
        });

        // 1. Get And Save Page Source (XML)
        console.log('1. Getting page source...');
        const source = await driver.getPageSource();
        console.log(`   Page source length: ${source.length} characters`);
        const sourcePath = path.resolve(__dirname, 'explorer_source_dump.xml');
        fs.writeFileSync(sourcePath, source);
        console.log(`   Saved page source to: ${sourcePath}`);

        const minimizeBtn = await driver.$('/Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]');
        console.log(minimizeBtn);


    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
