const { performance } = require('perf_hooks');
const { createDriver } = require('../util/setup');

async function main() {

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
            hostname: '192.168.8.245'
        });

        await checkTime(() => driver.execute('windows: setProcessForeground', { process: 'secureage.exe' }));

    } catch (e) {
        console.error(`ERROR in test case: ${e.message}`);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

main().catch(console.error);
