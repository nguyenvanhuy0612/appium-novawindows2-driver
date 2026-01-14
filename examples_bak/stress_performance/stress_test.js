const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        // hostname: '127.0.0.1',
        port: 4723,
        path: '/',
        capabilities: {
            "platformName": "Windows",
            "appium:automationName": "NovaWindows2",
            "appium:deviceName": "WindowsPC",
            // "appium:app": "Root", // "Root" or "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App"
            "appium:app": "Root", // Using Root for now
            "appium:newCommandTimeout": 3600,
            "appium:isolatedScriptExecution": false,
            // "appium:appTopLevelWindow": "0x123456", // Hex string of the window handle
            // "appium:smoothPointerMove": "linear", // e.g., "linear", "ease-in-out"
            // "appium:delayBeforeClick": 500, // ms
            // "appium:delayAfterClick": 500, // ms
            // "appium:shouldCloseApp": true,
            // "appium:appArguments": "",
            // "appium:appWorkingDir": "",
            "appium:appWaitForLaunchRetries": 20,
            "appium:appWaitForLaunchRetryIntervalMs": 500,
            // "appium:prerun": { "command": "...", "script": "..." },
            // "appium:postrun": { "command": "...", "script": "..." }
        },
        logLevel: 'error'
    };

    console.log('Initializing session...');
    let client;
    try {
        client = await remote(opts);
        console.log('Session created successfully.');

        // create function for each action in loop
        const actions = {
            getPageSource: async () => {
                const startTime = Date.now();
                try {
                    const source = await client.getPageSource();
                    console.log(`Page Source retrieval successful (Length: ${source.length} chars)`);
                } catch (e) {
                    console.log(`Expected error: ${e}`);
                }
                const endTime = Date.now();
                console.log(`getPageSource - Time taken: ${endTime - startTime} ms`);
            },
            getButtons: async () => {
                const startTime = Date.now();
                try {
                    const buttons = await client.findElements('xpath', '//Button');
                    console.log(`Buttons found: ${buttons.length}`);
                } catch (e) {
                    console.log(`Expected error: ${e}`);
                }
                const endTime = Date.now();
                console.log(`getButtons - Time taken: ${endTime - startTime} ms`);
            },
            getProcess: async () => {
                const startTime = Date.now();
                try {
                    const process = await client.executeScript('powerShell', ["Get-Process; exit 1"]);
                    console.log(`Process retrieval successful (Length: ${process.length} chars)`);
                } catch (e) {
                    console.log(`Expected error: ${e}`);
                }
                const endTime = Date.now();
                console.log(`getProcess - Time taken: ${endTime - startTime} ms`);
            },
            getWindows: async () => {
                const startTime = Date.now();
                try {
                    const windows = await client.findElements('xpath', '//Window');
                    console.log(`Windows found: ${windows.length}`);
                } catch (e) {
                    console.log(`Expected error: ${e}`);
                }
                const endTime = Date.now();
                console.log(`getWindows - Time taken: ${endTime - startTime} ms`);
            }
        };

        // for 100 times
        const startTime = Date.now();
        for (let i = 0; i < 100; i++) {
            const startCurTime = Date.now();
            console.log(`\nStart Action: ${i + 1}`);
            for (const action in actions) {
                await actions[action]();
            }
            console.log(`Total time taken for action ${i + 1}: ${Date.now() - startCurTime} ms`);
        }
        console.log(`\nTotal time taken: ${Date.now() - startTime} ms`);
    } catch (err) {
        console.error('Failed to create session:', err);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();
