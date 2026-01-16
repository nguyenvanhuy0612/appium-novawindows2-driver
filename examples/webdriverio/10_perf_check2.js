const { createDriver } = require('../util/setup');
const caps = {
    hostname: '192.168.8.245',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows',
        // 'appium:app': "Root"
        'appium:app': "C:\\Windows\\explorer.exe",
    }
};
const caps2 = {
    ...caps, capabilities: {
        ...caps.capabilities,
        'appium:automationName': 'NovaWindows2',
        'appium:includeContextElementInSearch': true
    }
};

async function main() {
    console.log('--- 10_perf_check2.js ---');
    let driver;
    let driver2;

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
        // driver = await createDriver(caps);
        driver2 = await createDriver(caps2);

        const locator = ['//*', '/Pane/Pane[1]/Pane[1]/ToolBar/Button[1]', '//Button'];
        for (const loc of locator) {
            console.log(`1. Finding ${loc} use NovaWindows2...`);
            const elements2 = await timeFunc(() => driver2.$$(loc));
            console.log(`   Elements found: ${elements2.length}`);
            /*
            console.log(`2. Finding ${loc} use NovaWindows...`);
            const elements = await timeFunc(() => driver.$$(loc));
            console.log(`   Elements found: ${elements.length}`);
            */
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        // if (driver) await driver.deleteSession();
        if (driver2) await driver2.deleteSession();
    }
}

if (require.main === module) {
    main();
}
