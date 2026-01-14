const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function main() {
    const options = {
        hostname: '192.168.196.155',
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

        const filename = 'legacy_test.txt';
        const remoteDir = "C:\\Users\\public\\Documents";
        const remotePath = `${remoteDir}\\${filename}`;
        const content = 'Hello from legacy execute command!';
        const base64Content = Buffer.from(content).toString('base64');

        // 1. Test pushFile
        console.log(`Testing pushFile (legacy) to ${remotePath}...`);
        await client.execute('pushFile', { path: remotePath, data: base64Content });
        console.log('pushFile executed.');

        // 2. Test pullFile
        console.log('Testing pullFile (legacy)...');
        const pulledBase64 = await client.execute('pullFile', { path: remotePath });
        const pulledContent = Buffer.from(pulledBase64, 'base64').toString('utf8');

        if (pulledContent === content) {
            console.log(`SUCCESS: pullFile content matches: "${pulledContent}"`);
        } else {
            console.error(`FAILURE: pullFile content mismatch! Expected "${content}", got "${pulledContent}"`);
        }

        // 3. Test pullFolder
        console.log('Testing pullFolder (legacy)...');
        const folderBase64 = await client.execute('pullFolder', { path: remoteDir });
        const zip = new AdmZip(Buffer.from(folderBase64, 'base64'));
        const zipEntries = zip.getEntries();

        console.log(`Zip contains ${zipEntries.length} entries.`);
        const found = zipEntries.some(entry => {
            const normalized = entry.entryName.replace(/\\/g, '/');
            return normalized === filename || normalized.endsWith('/' + filename);
        });

        if (found) {
            console.log('SUCCESS: pullFolder contains the pushed file.');
        } else {
            console.error('FAILURE: pullFolder does not contain the file!');
            console.log('Entries found:');
            zipEntries.forEach(e => console.log(` - ${e.entryName}`));
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
