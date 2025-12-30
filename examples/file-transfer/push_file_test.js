const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');

async function main() {
    const options = {
        hostname: '127.0.0.1',
        port: 4723,
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root'
        },
        logLevel: 'error'
    };

    let client = null;

    try {
        console.log('Creating session...');
        client = await remote(options);

        const targetPath = path.resolve(__dirname, '../temp/test_push.txt');
        const content = 'Hello from Appium pushFile!';
        const base64Data = Buffer.from(content).toString('base64');

        console.log(`Pushing file to: ${targetPath}`);
        await client.pushFile(targetPath, base64Data);

        console.log('File pushed. Verifying content...');
        const readContent = await client.execute('powerShell', `Get-Content '${targetPath}' -Raw`);

        console.log(`Read content: ${readContent.trim()}`);

        if (readContent.trim() === content) {
            console.log('SUCCESS: File content matches!');
        } else {
            console.error('FAILURE: Content mismatch!');
        }

    } catch (e) {
        console.error('Test failed:', e.message);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();
