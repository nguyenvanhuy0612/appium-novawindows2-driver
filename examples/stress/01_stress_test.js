const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 01_stress_test.js ---');
    let driver;
    try {
        driver = await createDriver({
            capabilities: {
                "appium:newCommandTimeout": 7200 // 2 hours
            }
        });

        // Define actions
        const actions = {
            getPageSource: async () => {
                await driver.getPageSource();
            },
            findWindows: async () => {
                await driver.$$('//Window');
            },
            getProcess: async () => {
                await driver.execute('powerShell', 'Get-Process | Select-Object -First 1');
            }
        };

        const ITERATIONS = 20;
        console.log(`Starting stress test: ${ITERATIONS} iterations...`);

        const startTotal = Date.now();

        for (let i = 0; i < ITERATIONS; i++) {
            process.stdout.write(`Iteration ${i + 1}/${ITERATIONS}: `);

            for (const [name, action] of Object.entries(actions)) {
                const start = Date.now();
                try {
                    await action();
                    process.stdout.write(`[${name}: ${(Date.now() - start)}ms] `);
                } catch (e) {
                    process.stdout.write(`[${name}: FAIL] `);
                    console.error(`\nError in ${name}:`, e.message);
                }
            }
            console.log(''); // Newline
        }

        console.log(`\nStress test completed in ${(Date.now() - startTotal) / 1000}s`);

    } catch (err) {
        console.error('Fatal Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
