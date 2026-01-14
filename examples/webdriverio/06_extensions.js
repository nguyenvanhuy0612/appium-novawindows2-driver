const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 06_extensions.js (Enhanced) ---');
    let driver;
    try {
        driver = await createDriver();

        // 1. PowerShell with output
        console.log('1. PowerShell: Get-Date');
        const output = await driver.execute('powerShell', 'Get-Date');
        console.log('   Output:', output.trim());

        // 2. PowerShell with Exit Code (hypothetical, depends on driver implementation details)
        // Often drivers return just stdout. If the command fails, it might throw.
        console.log('2. PowerShell: Error Checking');
        try {
            await driver.execute('powerShell', 'Get-InvalidCommand');
        } catch (e) {
            console.log('   Caught expected error from invalid command.');
        }

        // 3. Clipboard
        console.log('3. Clipboard operations');
        await driver.setClipboard(Buffer.from('ExtTest').toString('base64'), 'plaintext');
        const clip = await driver.getClipboard();
        console.log(`   Clipboard: ${Buffer.from(clip, 'base64').toString()}`);

        // 4. Scroll (windows: scrollIntoView)
        console.log('4. Scrolling (if element found)');
        try {
            const list = await driver.$('//List');
            const item = await list.$('//ListItem[last()]');
            await driver.execute('windows: scrollIntoView', item);
            console.log('   Scrolled to last item.');
        } catch (ignore) {
            console.log('   Skipped scroll test (no list found).');
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
