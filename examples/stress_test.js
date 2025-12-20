const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 60
        },
        logLevel: 'error'
    };

    console.log('Initializing session...');
    let client;
    try {
        client = await remote(opts);
        console.log('Session created successfully.');

        // for 100 times
        const startTime = Date.now();
        for (let i = 0; i < 100; i++) {
            const startCurTime = Date.now();
            console.log(`Start Action: ${i + 1}`);
            const source = await client.getPageSource();
            console.log(`Page Source retrieval successful (Length: ${source.length} chars)`);

            const buttons = await client.findElements('xpath', '//Button');
            console.log(`Buttons found: ${buttons.length}`);

            const process = await client.executeScript('powerShell', "Get-Process");
            console.log(`Process: ${process}`);

            console.log(`Time taken: ${Date.now() - startCurTime} ms`);
        }
        const endTime = Date.now();
        console.log(`Total time taken: ${endTime - startTime} ms`);
    } catch (err) {
        console.error('Failed to create session:', err);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();
