const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 04_interactions.js (Enhanced) ---');
    let driver;
    try {
        // Launch Notepad
        driver = await createDriver({
            capabilities: { "appium:app": "C:\\Windows\\System32\\notepad.exe" }
        });

        const editor = await driver.$('//Document | //Edit');

        // 1. Keys (Special Keys)
        console.log('1. Sending Special Keys...');
        // Using Unicode PUA for special keys
        const ENTER = '\uE007';
        const SHIFT = '\uE008';

        await editor.setValue(`Line 1${ENTER}Line 2${ENTER}`);

        // 2. Click / Double Click / Context Click
        console.log('2. Mouse Interactions...');
        await editor.click(); // Normal click

        console.log('   Double Click...');
        await editor.doubleClick();

        console.log('   Right Click...');
        await editor.click({ button: 'right' });
        // Or: await editor.contextMenu();

        // 3. Actions API (W3C Actions)
        console.log('3. W3C Actions API (Mouse Move & Click)...');
        // Perform a complex action: Move to element, click down, release
        await driver.performActions([{
            type: 'pointer',
            id: 'mouse',
            parameters: { pointerType: 'mouse' },
            actions: [
                { type: 'pointerMove', duration: 0, origin: editor },
                { type: 'pointerDown', button: 0 },
                { type: 'pause', duration: 100 },
                { type: 'pointerUp', button: 0 }
            ]
        }]);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
