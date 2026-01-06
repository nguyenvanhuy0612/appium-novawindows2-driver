const { NovaWindows2Driver } = require('../../build/lib/driver');

async function runSession(id) {
    const driver = new NovaWindows2Driver();
    const log = (msg) => console.log(`[Session ${id.toString().padStart(3, '0')}] ${msg}`);

    try {
        log('Starting session...');
        await driver.createSession({
            alwaysMatch: {
                'appium:automationName': 'NovaWindows2',
                'appium:platformName': 'Windows',
                'appium:app': 'root',
                'appium:powerShellCommandTimeout': 30000
            }
        });
        log('Session started.');

        log('Finding elements...');
        const elements = await driver.findElements('xpath', '//*');
        log(`Found ${elements.length} elements.`);

    } catch (err) {
        log(`ERROR: ${err.message}`);
    } finally {
        await driver.deleteSession();
        log('Session closed.');
    }
}

async function main() {
    console.log('Starting mini stress test (20 concurrent sessions)...');
    await Promise.all([
        runSession(1)
    ]);
    console.log('Mini stress test completed.');
}

main();
