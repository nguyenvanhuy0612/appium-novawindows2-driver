const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

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

        const tempDir = path.resolve(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const filename = 'test_pull.txt';
        const targetPath = path.join(tempDir, filename);
        const content = 'Data for pullFile test';
        const base64Content = Buffer.from(content).toString('base64');

        // 1. Setup: Push file
        console.log(`Pushing file to: ${targetPath}`);
        await client.pushFile(targetPath, base64Content);

        // 2. Test pullFile
        console.log('Testing pullFile...');
        const pulledBase64 = await client.pullFile(targetPath);
        const pulledContent = Buffer.from(pulledBase64, 'base64').toString('utf8');

        if (pulledContent === content) {
            console.log('SUCCESS: pullFile content matches.');
        } else {
            console.error('FAILURE: pullFile content mismatch!');
            console.error('Expected:', content);
            console.error('Got:', pulledContent);
        }

        // 3. Test pullFolder
        console.log('Testing pullFolder...');
        // Pull the temp directory
        const pulledFolderBase64 = await client.pullFolder(tempDir);
        const zip = new AdmZip(Buffer.from(pulledFolderBase64, 'base64'));
        const zipEntries = zip.getEntries();

        console.log(`Zip contains ${zipEntries.length} entries.`);
        const found = zipEntries.some(entry => entry.entryName === filename || entry.entryName.endsWith('/' + filename));

        if (found) {
            console.log('SUCCESS: pullFolder contains the expected file.');
        } else {
            console.error('FAILURE: pullFolder does not contain the file!');
            zipEntries.forEach(e => console.log(' - ' + e.entryName));
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
