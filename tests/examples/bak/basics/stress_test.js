const { NovaWindows2Driver } = require('../../build/lib/driver');
const { W3C_ELEMENT_KEY } = require('@appium/base-driver');

async function runSession(id) {
    const driver = new NovaWindows2Driver();
    driver.caps = {
        automationName: 'NovaWindows2',
        platformName: 'Windows',
        app: 'root', // Desktop root for searching
        powerShellCommandTimeout: 30000
    };

    const log = (msg) => console.log(`[Session ${id.toString().padStart(3, '0')}] ${msg}`);

    try {
        // Random initial delay to stagger starts
        await new Promise(r => setTimeout(r, Math.random() * 5000));

        log('Starting session...');
        await driver.createSession({ alwaysMatch: { 'appium:automationName': 'NovaWindows2', 'appium:platformName': 'Windows', 'appium:app': 'root' } });
        log('Session started.');

        for (let i = 0; i < 3; i++) {
            // Random delay between actions
            await new Promise(r => setTimeout(r, Math.random() * 2000));

            const action = Math.random() > 0.5 ? 'source' : 'find';
            if (action === 'source') {
                log('Fetching page source...');
                const source = await driver.getPageSource();
                log(`Page source fetched (length: ${source.length})`);
            } else {
                log('Finding all elements with XPath //* ...');
                const elements = await driver.findElements('xpath', '//*');
                log(`Found ${elements.length} elements.`);

                // Randomly pick up to 5 elements to get attributes for, or all if less than 5
                const count = Math.min(elements.length, 5);
                const shuffled = elements.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                for (const el of selected) {
                    const elId = el[W3C_ELEMENT_KEY];
                    try {
                        const name = await driver.getProperty('Name', elId);
                        log(`Element ${elId} Name: "${name}"`);
                    } catch (e) {
                        log(`Failed to get Name for element ${elId}`);
                    }
                }
            }
        }

        log('Finishing session...');
    } catch (err) {
        log(`ERROR: ${err.message}`);
    } finally {
        try {
            await driver.deleteSession();
            log('Session closed.');
        } catch (e) {
            log(`Error during cleanup: ${e.message}`);
        }
    }
}

async function main() {
    const totalSessions = 100;
    const concurrentLimit = 10; // Run 10 at a time to avoid crashing the machine completely

    console.log(`Starting stress test: ${totalSessions} total sessions, limit ${concurrentLimit} concurrent.`);

    const sessions = [];
    for (let i = 1; i <= totalSessions; i++) {
        sessions.push(i);
    }

    const chunks = [];
    for (let i = 0; i < sessions.length; i += concurrentLimit) {
        chunks.push(sessions.slice(i, i + concurrentLimit));
    }

    for (const chunk of chunks) {
        console.log(`--- Running chunk of ${chunk.length} sessions ---`);
        await Promise.all(chunk.map(id => runSession(id)));
    }

    console.log('Stress test completed.');
}

main();
