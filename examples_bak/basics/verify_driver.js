const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');

async function main() {
    const opts = {
        // hostname: '127.0.0.1',
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root", // Using Root to attach to desktop, verify this is supported
            "appium:newCommandTimeout": 60
        },
        // logLevel: 'debug'
        logLevel: 'error'
    };

    const action = async (func) => {
        const startTime = Date.now();
        const result = await func();
        const endTime = Date.now();
        console.log(`Action took: ${endTime - startTime} ms`);
        return result;
    }

    console.log('Initializing session...');
    let client;
    try {
        client = await remote(opts);
        console.log('Session created successfully.');
        console.log('Session capabilities: ', client.capabilities);
        await action(() => client.getPageSource());

        await action(() => client.findElements('xpath', '//Button'));
        await action(() => client.findElements('xpath', '//Edit'));
    } catch (err) {
        console.error('Failed to create session:', err);
    } finally {
        if (client) {
            console.log('Deleting session...');
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
