const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 01_basic_session.js (Enhanced) ---');
    let driver;
    try {
        // 1. Create a session with expanded constraints check
        console.log('Creating session...');
        // Demo: We can suggest 'appium:appTopLevelWindow' instead of 'app' to attach to a specific window handle
        driver = await createDriver();
        console.log(`Session ID: ${driver.sessionId}`);

        // 2. Window Handles
        console.log('Getting Window Handles...');
        const handles = await driver.getWindowHandles();
        console.log(`Open Windows: ${handles.length}`);
        if (handles.length > 0) {
            console.log(`First Handle: ${handles[0]}`);

            // Switch to window (if applicable)
            // await driver.switchToWindow(handles[0]);
        }

        // 3. Current Window Info
        const handle = await driver.getWindowHandle();
        console.log(`Current Window Handle: ${handle}`);

        // 4. Set/Get Window Size/Position
        try {
            const rect = await driver.getWindowRect();
            console.log(`Window Rect: ${JSON.stringify(rect)}`);

            // await driver.setWindowRect(0, 0, 800, 600);
        } catch (e) {
            console.log('Window Rect operations might not be supported on Root session.');
        }

    } catch (err) {
        console.error('Error in session example:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
