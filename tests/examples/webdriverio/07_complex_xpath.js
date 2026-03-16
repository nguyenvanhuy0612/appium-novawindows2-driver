const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 07_complex_xpath.js ---');
    let driver;
    try {
        driver = await createDriver();

        // 1. Predicates
        console.log('1. Predicate: Button with specific Name AND IsEnabled');
        try {
            const btn = await driver.$('//Button[@Name="Start" and @IsEnabled="true"]');
            console.log('   Found Start button via composite predicate.');
        } catch (e) { console.log('   Failed: ' + e.message); }

        // 2. Axes: Parent
        console.log('2. Axis: Parent (Finding Window of Start button)');
        try {
            // Find the window that contains the Start button (which is the AppBar/Taskbar, or Desktop)
            // Adjust hierarchy based on actual UI
            const parent = await driver.$('//Button[@Name="Start"]/parent::*');
            console.log(`   Parent localized type: ${await parent.getAttribute('LocalizedControlType')}`);
        } catch (e) { console.log('   Failed: ' + e.message); }

        // 3. Axes: Following Sibling
        console.log('3. Axis: Following Sibling');
        try {
            // Find a button that follows another button
            const siblings = await driver.$$('//Button[@Name="Start"]/following-sibling::*');
            console.log(`   Found ${siblings.length} siblings after Start button.`);
        } catch (e) { console.log('   Failed: ' + e.message); }

        // 4. Functions: last() and position()
        console.log('4. Functions: last() & position()');
        try {
            // Find the last child of the Taskbar
            const lastChild = await driver.$('//*[@ClassName="Shell_TrayWnd"]').then(t => t.$('.//*[last()]'));
            console.log(`   Last child localized type: ${await lastChild.getAttribute('LocalizedControlType')}`);
        } catch (e) { console.log('   Failed: ' + e.message); }

        // 5. Implicit Attributes (Width > X)
        // Note: The driver supports 'width', 'height', 'x', 'y' in predicates
        console.log('5. implicit attributes: Window with width > 0');
        try {
            const wideElements = await driver.$$('//Window[@width > 0]');
            console.log(`   Found ${wideElements.length} windows with width > 0.`);
        } catch (e) { console.log('   Failed: ' + e.message); }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
