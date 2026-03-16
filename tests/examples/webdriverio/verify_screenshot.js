const { createDriver } = require('../util/setup');
const caps = {
    hostname: '192.168.8.245',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': "C:\\Program Files\\SecureAge\\bin\\SecureAge.exe",
        // 'appium:app': "Root",
    }
};

async function main() {
    let driver;

    const timeFunc = async (func) => {
        const start = performance.now();
        try {
            const res = await func();
            const end = performance.now();
            console.log(`Time taken: ${end - start}ms`);
            return res;
        } catch (e) {
            const end = performance.now();
            console.log(`Time taken: ${end - start}ms`);
            throw e;
        }
    };

    try {
        driver = await createDriver(caps);

        const source = await timeFunc(() => driver.getPageSource());
        console.log(`Source length: ${source.length}`);

        console.log('Taking screenshot...');
        await driver.saveScreenshot('screenshot_verify.png');
        console.log('Screenshot taken successfully.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
