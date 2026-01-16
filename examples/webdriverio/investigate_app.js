const { createDriver } = require('../util/setup');
const fs = require('fs');
const path = require('path');

async function main() {
    let driver;
    try {
        console.log('--- Connecting to App (explorer.exe) ---');
        driver = await createDriver({
            hostname: '192.168.1.19',
            capabilities: {
                platformName: 'Windows',
                'appium:deviceName': 'WindowsPC',
                'appium:app': 'C:\\Windows\\explorer.exe'
            }
        });

        // 1. Get Root Info
        console.log('1. Getting Session Root info...');
        // We can get root by finding self via '/' or similar, but let's try finding /Window
        const selfMatch = await driver.$('/Window');
        console.log('   /Window matches:');
        console.log('   Name:', await selfMatch.getAttribute('Name'));
        console.log('   RuntimeId:', await selfMatch.getAttribute('RuntimeId'));

        // 2. Try the user's FULL XPath
        console.log('2. Trying user XPath: /Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]');
        try {
            const btn = await driver.$('/Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]');
            console.log('   Found button!');
            console.log('   Button Name:', await btn.getAttribute('Name'));
            console.log('   Button RuntimeId:', await btn.getAttribute('RuntimeId'));
        } catch (e) {
            console.log('   Failed to find button:', e.message);
        }

        // 2.1 Control Test: Find Close Button
        console.log('2.1. Control Test: Finding Close Button...');
        try {
            const closeBtn = await driver.$('/Window/TitleBar/Button[@Name="Close"]');
            console.log('   Found Close Button!');
            console.log('   Name:', await closeBtn.getAttribute('Name'));
        } catch (e) {
            console.log('   Failed to find Close Button:', e.message);
        }

        // 3. Dump Children of the Window (Self)
        console.log('3. Dumping children of the found Window...');
        const children = await selfMatch.$$('/*');
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const name = await child.getAttribute('Name');
            const controlType = await child.getTagName();
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
