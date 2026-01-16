const { createDriver } = require('../util/setup');
const caps = {
    hostname: '192.168.8.245',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        'appium:app': "Root"
    }
};
const caps2 = {
    hostname: '192.168.8.245',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': "Root",
        'appium:includeContextElementInSearch': true
    }
};

async function main() {
    console.log('--- 10_perf_check2.js ---');
    let driver;
    let driver2;
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
        driver = await createDriver(caps);
        driver2 = await createDriver(caps2);
        
        const locator = ['//*', '/Pane/Pane[1]/Pane[1]/ToolBar/Button[1]', '//Button'];
        for (const loc of locator) {
            console.log(`1. Finding ${loc} use NovaWindows...`);
            const elements = await timeFunc(() => driver.$$(loc));
            console.log(`   Elements found: ${elements.length}`);
            console.log(`2. Finding ${loc} use NovaWindows2...`);
            const elements2 = await timeFunc(() => driver2.$$(loc));
            console.log(`   Elements found: ${elements2.length}`);
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
        if (driver2) await driver2.deleteSession();
    }
}

if (require.main === module) {
    main();
}
