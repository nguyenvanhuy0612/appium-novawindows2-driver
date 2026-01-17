const { createDriver, sleep } = require('../util/setup');
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
            return null;
        }
    };

    try {
        driver = await createDriver(caps);
        for (let i = 0; i < 10; i++) {
            const windows = await driver.$$("//Window[starts-with(@Name,'SecureAge')]");
            if (windows?.length > 0) {
                console.log(`Windows length: ${windows.length}`);
                break;
            }
            await sleep(1000);
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
