const { remote } = require('webdriverio');

/**
 * WebDriverIO Stress Test Configuration
 * This script launches parallel sessions against an Appium server running the NovaWindows2 driver.
 */

async function runSession(id) {
    const log = (msg) => console.log(`[Session ${id.toString().padStart(3, '0')}] ${msg}`);

    const wdioOpts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root',
        },
        logLevel: 'error'
    };

    let browser;
    try {
        // Random initial delay to stagger starts
        await new Promise(r => setTimeout(r, Math.random() * 10000));

        log('Initializing WebDriverIO session...');
        browser = await remote(wdioOpts);
        log('Session created.');

        for (let i = 0; i < 3; i++) {
            // Random delay between actions
            await new Promise(r => setTimeout(r, Math.random() * 3000));

            const action = Math.random() > 0.5 ? 'source' : 'find';
            if (action === 'source') {
                log('Getting Page Source...');
                const source = await browser.getPageSource();
                log(`Page source retrieved (length: ${source.length})`);
            } else {
                log('Finding elements via XPath //* ...');
                const elements = await browser.$$('//*');
                log(`Found ${elements.length} elements.`);

                // Randomly pick up to 5 elements to get attributes
                const count = Math.min(elements.length, 5);
                const shuffled = elements.sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, count);

                for (const el of selected) {
                    try {
                        const all = await el.getAttribute('all');
                        log(`Element ${el.elementId} Attributes: "${all}"`);
                    } catch (e) {
                        log(`Failed to get attribute for element: ${e.message}`);
                    }
                    try {
                        // click
                        await el.click();
                    } catch (e) {
                        log(`Failed to click element: ${e.message}`);
                    }
                }
            }
        }

        log('Finished test sequence.');
    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`);
    } finally {
        if (browser) {
            try {
                await browser.deleteSession();
                log('Session deleted.');
            } catch (e) {
                log(`Cleanup error: ${e.message}`);
            }
        }
    }
}

async function main() {
    const totalSessions = 100;
    const concurrentLimit = 10; // Adjust based on Test Machine capacity

    console.log(`Starting WebDriverIO Stress Test: ${totalSessions} total sessions, ${concurrentLimit} concurrent.`);

    const sessions = Array.from({ length: totalSessions }, (_, i) => i + 1);
    const chunks = [];
    for (let i = 0; i < sessions.length; i += concurrentLimit) {
        chunks.push(sessions.slice(i, i + concurrentLimit));
    }

    const start = Date.now();
    for (const chunk of chunks) {
        console.log(`--- Starting batch of ${chunk.length} sessions ---`);
        await Promise.all(chunk.map(id => runSession(id)));
    }
    const duration = (Date.now() - start) / 1000;

    console.log(`Stress test completed in ${duration.toFixed(2)} seconds.`);
}

main().catch(console.error);
