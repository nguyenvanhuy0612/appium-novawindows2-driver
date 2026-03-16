const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    let driver;
    try {
        console.log('--- Connecting to Root (Desktop) ---');
        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:deviceName': 'WindowsPC',
                'appium:app': 'Root' // Connect to Desktop Root
            }
        });

        // 1. Find the Window corresponding to Explorer
        console.log('1. Finding Explorer Window from Root...');
        // Using Name="File Explorer" assuming English. ClassName="CabinetWClass" is safer.
        const window = await driver.$('//Window[@ClassName="CabinetWClass"]');
        console.log('   Found Window:', await window.getAttribute('Name'));
        console.log('   RuntimeId:', await window.getAttribute('RuntimeId'));

        // 2. Try the user's FULL XPath from Root (assuming it works here)
        // User path: /Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]
        // From Root, we need to match the Window first. 
        // If user path starts with /Window, and we are at Root, it should match the window.
        // But if there are multiple windows, /Window might match the WRONG one (e.g. Taskbar is "Pane", typically).
        // Let's try finding the element using the generic /Window start
        console.log('2. Trying user XPath from Root: /Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]');
        try {
            const btn = await driver.$('/Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]');
            console.log('   Found button!');
            console.log('   Button Name:', await btn.getAttribute('Name'));
            console.log('   Button RuntimeId:', await btn.getAttribute('RuntimeId'));

            // Check Parent Window of this button to verify it's the same window
            // (We can't easily traverse up with standard commands nicely without loop, but good enough to see if it found it)
        } catch (e) {
            console.log('   Failed to find button from Root:', e.message);
        }

        // 2.1 Control Test: Find Close Button which definitely exists (Child[4] -> Button)
        // XPath: /Window/TitleBar/Button[@Name="Close"]
        console.log('2.1. Control Test: Finding Close Button...');
        try {
            const closeBtn = await driver.$('/Window/TitleBar/Button[@Name="Close"]');
            console.log('   Found Close Button!');
            console.log('   Name:', await closeBtn.getAttribute('Name'));
        } catch (e) {
            console.log('   Failed to find Close Button:', e.message);
        }

        // 3. Dump Window children to understand "Pane[2]"
        console.log('3. Dumping children of the found Explorer Window...');
        const children = await window.$$('/*'); // Immediate children
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const name = await child.getAttribute('Name');
            const controlType = await child.getTagName(); // returns control type
            const className = await child.getAttribute('ClassName');
            const runtimeId = await child.getAttribute('RuntimeId');
            console.log(`   Child[${i + 1}]: ${controlType} ("${name}") Class="${className}" RuntimeId="${runtimeId}"`);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
