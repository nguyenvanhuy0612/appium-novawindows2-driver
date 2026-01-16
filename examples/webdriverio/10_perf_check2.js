const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('--- 10_perf_check2.js ---');
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
                'appium:app': "Root"
            }
        });

        // 1. Find elements with NovaWindows
        console.log('1. Finding all elements use NovaWindows...');
        const elements = await timeFunc(() => driver.$$('//*'));
        console.log(`   Elements found: ${elements.length}`);
        //console.log(elements);

        await driver.deleteSession();

        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:automationName': 'NovaWindows2',
                'appium:app': "Root",
                'appium:includeContextElementInSearch': true
            }
        });

        // 2. Find elements with NovaWindows2
        console.log('2. Finding all elements use NovaWindows2...');
        const elements2 = await timeFunc(() => driver.$$('//*'));
        console.log(`   Elements found: ${elements2.length}`);
        //console.log(elements2);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
