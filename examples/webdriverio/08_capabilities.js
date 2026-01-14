const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 08_capabilities.js ---');
    let driver;

    try {
        // ----------------------------------------------------
        // Test 1: Type Delay & Dynamic Configuration
        // ----------------------------------------------------
        console.log('\n[Test 1] Type Delay (Caps & Extension)');
        driver = await createDriver({
            capabilities: {
                "appium:app": "C:\\Windows\\System32\\notepad.exe",
                "appium:typeDelay": 100 // Cap: 100ms
            }
        });

        const editor = await driver.$('//*[@ClassName="Edit"]'); // Notepad Edit
        if (await editor.isExisting()) {
            console.log('  Typing "Slow" with 100ms cap...');
            await editor.setValue('Slow');

            console.log('  Changing delay to 500ms via command...');
            await driver.execute('windows: typeDelay', { delay: 500 });
            console.log('  Typing "Slower"...');
            await editor.addValue('Slower');
        }
        await driver.deleteSession();

        // ----------------------------------------------------
        // Test 2: PowerShell Timeout
        // ----------------------------------------------------
        console.log('\n[Test 2] PowerShell Command Timeout');
        driver = await createDriver({
            capabilities: {
                "appium:powerShellCommandTimeout": 3000 // 3s timeout
            }
        });

        console.log('  Running slow command (5s) with 3s timeout...');
        try {
            await driver.executeScript('powerShell', ['Start-Sleep -Seconds 5']);
            console.log('  [FAIL] Command should have timed out.');
        } catch (e) {
            console.log('  [PASS] Command timed out as expected.');
        }
        await driver.deleteSession();

        // ----------------------------------------------------
        // Test 3: Other Caps (delayBeforeClick, smoothPointerMove)
        // ----------------------------------------------------
        console.log('\n[Test 3] Interaction Delays & Pointer Move');
        driver = await createDriver({
            capabilities: {
                "appium:app": "Root",
                "appium:delayBeforeClick": 500,
                "appium:delayAfterClick": 500,
                "appium:smoothPointerMove": "true"
            }
        });

        console.log('  Clicking Start button with delays...');
        try {
            const start = await driver.$('//*[@Name="Start"]');
            await start.click();
            console.log('  Click executed (check strictly if delays were felt during manual observation).');

            // Close start menu if opened
            await start.click();
        } catch (e) {
            console.log('  Could not click Start: ' + e.message);
        }
        await driver.deleteSession();

    } catch (err) {
        console.error('Fatal Error:', err);
    }
}

if (require.main === module) {
    main();
}
