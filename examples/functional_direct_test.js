const { NovaWindows2Driver } = require('../build/lib/driver');

async function main() {
    const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';
    const log = (msg) => console.log(`[FunctionalDirect] ${msg}`);

    const driver = new NovaWindows2Driver(); // Create driver instance directly

    try {
        log('Creating Session...');
        await driver.createSession({
            alwaysMatch: {
                'appium:automationName': 'NovaWindows2',
                'appium:platformName': 'Windows',
                'appium:app': 'Root',
                'appium:powerShellCommandTimeout': 20000
            }
        });
        log('Session created.');

        // 1. Get Window Rect
        log('Testing: getWindowRect...');
        const windowRect = await driver.getWindowRect();
        log(`Window Rect: ${JSON.stringify(windowRect)}`);

        // 2. Get Page Source (Timing Check)
        log('Testing: getPageSource...');
        const start = Date.now();
        try {
            const source = await driver.getPageSource();
            const duration = Date.now() - start;
            log(`Page Source retrieved in ${duration}ms (length: ${source.length})`);
        } catch (e) {
            log(`Page Source failed or timed out: ${e.message}`);
        }

        // 3. Find Elements (Use 'name' strategy for 'Taskbar' or similar which is usually present)
        log('Testing: findElements (name "Taskbar")...');
        // 'Taskbar' is a common element on Windows Desktop
        let elements = [];
        try {
            elements = await driver.findElements('name', 'Taskbar');
            log(`Found ${elements.length} elements with name 'Taskbar'.`);

            if (elements.length === 0) {
                log('Taskbar not found, trying findElements (xpath /*/*[1]) for any child...');
                elements = await driver.findElements('xpath', '/*/*[1]');
            }
        } catch (e) {
            log(`Find elements failed: ${e.message}`);
        }

        if (elements.length > 0) {
            // Pick the first one
            const count = Math.min(elements.length, 1);
            const selected = elements.slice(0, count);

            for (let i = 0; i < selected.length; i++) {
                const elFn = selected[i];
                const elId = elFn[W3C_ELEMENT_KEY]; // Extract element ID

                // 4. Get Element Rect
                try {
                    const rect = await driver.getElementRect(elId);
                    log(`   Rect: ${JSON.stringify(rect)}`);
                } catch (e) {
                    log(`   Failed to get rect: ${e.message}`);
                }

                // 5. Get Attibute / Property
                try {
                    const name = await driver.getAttribute('Name', elId);
                    log(`   Name: "${name}"`);
                } catch (e) {
                    log(`   Failed to get Name: ${e.message}`);
                }

                try {
                    const type = await driver.getAttribute('ControlType', elId);
                    log(`   ControlType: "${type}"`);
                } catch (e) {
                    log(`   Failed to get ControlType: ${e.message}`);
                }

                // 6. Get Text
                try {
                    const text = await driver.getText(elId);
                    log(`   Text: "${text}"`);
                } catch (e) {
                    log(`   Failed to get text: ${e.message}`);
                }

                // 7. Check Displayed/Enabled
                try {
                    const displayed = await driver.elementDisplayed(elId);
                    const enabled = await driver.elementEnabled(elId);
                    log(`   Displayed: ${displayed}, Enabled: ${enabled}`);
                } catch (e) {
                    log(`   Failed to check state: ${e.message}`);
                }
            }
        }

        // 8. Screenshot
        log('Testing: getScreenshot...'); // getScreenshot in app.ts
        const screenshot = await driver.getScreenshot();
        log(`Screenshot taken (length: ${screenshot.length})`);

        log('Test Completed Successfully.');

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`);
        console.error(err);
    } finally {
        try {
            await driver.deleteSession();
            log('Session deleted.');
        } catch (e) {
            log(`Failed to cleanup: ${e.message}`);
        }
    }
}

main();
