const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 06_1_clipboard.js (Clipboard) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245'
        });

        const base64Text = Buffer.from('ExtTest').toString('base64');
        const result = await driver.executeScript('windows: setClipboard', [{ b64Content: base64Text, contentType: 'plaintext' }]);
        console.log('  Result:', result);

        const clip = await driver.executeScript('windows: getClipboard', []);
        console.log('  Clipboard:', clip);
        const text = Buffer.from(clip, 'base64').toString('utf-8');
        console.log('  Text:', text);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main().catch(console.error);
}
