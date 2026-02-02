const { performance } = require('perf_hooks');
const { createDriver } = require('../util/setup');

async function runTest(includeContext, convertAbsolute) {
    console.log(`\n--- Testing with includeContextElementInSearch=${includeContext}, convertAbsoluteXPathToRelativeFromElement=${convertAbsolute} ---`);
    let driver;
    const checkTime = async (func) => {
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
        driver = await createDriver({
            hostname: '192.168.8.245',
            capabilities: {
                'appium:convertAbsoluteXPathToRelativeFromElement': convertAbsolute,
                'appium:includeContextElementInSearch': includeContext
            }
        });

        console.log('Finding parent window...');
        // We use a known window name from the previous example
        const parent = await checkTime(() => driver.$('xpath://Window[@Name="SecureAge - Select Recipients"]'));

        console.log('Finding child elements from parent...');
        // We assume we are looking for the same element as before
        const parent_absolute_childs = await checkTime(() => parent.$$('xpath://Window[@Name="SecureAge - Select Recipients"]//ListItem'));
        const parent_relative_childs = await checkTime(() => parent.$$('xpath:.//ListItem'));
        const parent_no_relative_childs = await checkTime(() => parent.$$('xpath://ListItem'));

        const driver_absolute_childs = await checkTime(() => driver.$$('xpath://Window[@Name="SecureAge - Select Recipients"]//ListItem'));
        const driver_relative_childs = await checkTime(() => driver.$$('xpath:.//ListItem'));
        const driver_no_relative_childs = await checkTime(() => driver.$$('xpath://ListItem'));

        console.log(`Parent absolute child count: ${parent_absolute_childs.length}`);
        console.log(`Parent relative child count: ${parent_relative_childs.length}`);
        console.log(`Parent no relative child count: ${parent_no_relative_childs.length}`);
        
        console.log(`Driver absolute child count: ${driver_absolute_childs.length}`);
        console.log(`Driver relative child count: ${driver_relative_childs.length}`);
        console.log(`Driver no relative child count: ${driver_no_relative_childs.length}`);

    } catch (e) {
        console.error(`ERROR in test case: ${e.message}`);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

async function main() {
    // 1. True, True (The fix case)
    await runTest(true, true);

    // 2. True, False
    await runTest(true, false);

    // 3. False, True
    await runTest(false, true);

    // 4. False, False
    await runTest(false, false);
}

main().catch(console.error);
