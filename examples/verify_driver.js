const { remote } = require('webdriverio');
const fs = require('fs');
const path = require('path');

async function main() {
    const opts = {
        hostname: '127.0.0.1',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root", // Using Root to attach to desktop, verify this is supported
            "appium:newCommandTimeout": 60
        },
        logLevel: 'error'
    };

    console.log('Initializing session...');
    let client;
    try {
        client = await remote(opts);
        console.log('Session created successfully.');
    } catch (err) {
        console.error('Failed to create session:', err);
        return;
    }

    try {
        // 1. Get Page Source
        console.log('Test 1: Get Page Source (SKIPPED - too slow for Root)');
        //const source = await client.getPageSource();
        //console.log(`Page Source retrieval successful (Length: ${source.length} chars)`);

        // 2. Maximize Window
        // Note: For Root, maximize might not be applicable to the "desktop" window itself in the same way, 
        // but we can try getting window size or finding a window to maximize. 
        // For simplicity, we just log window size.
        console.log('Test 2: Get Window Rect');
        const rect = await client.getWindowRect();
        console.log(`Window Rect: ${JSON.stringify(rect)}`);

        // 3. Take Screenshot
        console.log('Test 3: Take Screenshot');
        const screenshotPath = path.resolve(__dirname, 'screenshot.png');
        await client.saveScreenshot(screenshotPath);
        if (fs.existsSync(screenshotPath)) {
            console.log(`Screenshot saved to: ${screenshotPath}`);
        } else {
            console.error('Screenshot failed to save.');
        }

        // 4. Find Element
        console.log('Test 4: Find Element (XPath)');
        // Try to find the Taskbar or Start button. 
        // Common on Windows 10/11: "Starry" or name="Start"
        // Let's try a generic find first
        const element = await client.$('//*');
        if (element.error) {
            console.error('Failed to find root element');
        } else {
            console.log(`Found root element with ID: ${element.elementId}`);
        }



        // 5. Get Window Handle
        console.log('Test 5: Get Window Handle');
        const handle = await client.getWindowHandle();
        console.log(`Window Handle: ${handle}`);

        // 6. Execute powershell command
        console.log('Test 6: Execute powershell command');
        const result = await client.executeScript('powerShell', [{ 'command': 'Get-Process' }]);
        // console.log(`Result: ${JSON.stringify(result)}`); // Output can be huge, maybe truncate
        console.log(`Result length: ${JSON.stringify(result).length} chars`);

        // 7. Execute powershell command with exit
        console.log('Test 7: Execute powershell command with exit');
        try {
            const resultExit = await client.executeScript('powerShell', [{ 'command': 'Get-Process; exit 0' }]);
            console.log(`Result exit length: ${JSON.stringify(resultExit).length}`);
        } catch (e) {
            console.log(`Test 7 encountered error as expected (or unexpected): ${e.message}`);
        }

        // 7.5 Recovery Check
        console.log('Test 7.5: Recovery Check with simple command');
        console.log('Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const output = await client.executeScript('powerShell', [{ command: 'Get-Process | Select-Object -First 1' }]);
            console.log('Test 7.5 passed. Recovery seems to work for simple commands.');
        } catch (e) {
            console.error('Test 7.5 failed:', e.message);
        }

        // 8. Click on Start button (Safe Locator)
        console.log('Test 8: Click on Start button (Safe Locator)');
        console.log('Waiting 3 seconds before Test 8...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Use direct child path to avoid deep recursion on Root
        let startButton;
        try {
            // Try to find Taskbar by class name (direct child of Root usually)
            // Then find Start button inside it.
            // Note: XPath `//` is recursive. We want direct child.
            // But client.$ calls `xpathToElIdOrIds`.
            // If we use `xpath`, we can force direct children?
            // `/Pane[@ClassName="Shell_TrayWnd"]` is absolute path from Root?
            // No, `xpath-analyzer` treats `/` as absolute from root.
            // Let's try finding Taskbar first using absolute path.

            // However, client.$ prefixing is tricky if we don't start with /
            // If we start with /, it's absolute.

            const taskbar = await client.$('/Pane[@ClassName="Shell_TrayWnd"]');
            startButton = await taskbar.$('Button[@Name="Start"]');
        } catch (e) {
            console.log('Safe locator failed: ' + e.message);
        }

        if (!startButton || startButton.error) {
            console.log('Could not find Start button with safe locator. Skipping click.');
        } else {
            await startButton.click();
            console.log('Clicked Start button (Test 8 passed).');
        }

    } catch (err) {
        console.error('Test execution failed:', err);
    } finally {
        if (client) {
            console.log('Deleting session...');
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
