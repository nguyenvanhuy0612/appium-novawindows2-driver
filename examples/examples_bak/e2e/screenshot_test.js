const { remote } = require('webdriverio');
const path = require('path');
const fs = require('fs');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const opts = {
        hostname: '192.168.8.245',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 300
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Initializing session...');
        client = await remote(opts);
        console.log('Session initialized.');

        // get source
        try {
            const source = await client.getPageSource();
            // console.log(source); // Commented out to reduce noise, enable if needed
            console.log(`Got page source. source.length: ${source.length}`);
        } catch (err) {
            console.error("Failed to get page source:", err.message);
        }

        // take screenshot
        try {
            console.log('Taking screenshot...');
            const screenshotBase64 = await client.takeScreenshot();
            console.log('Screenshot taken (Base64 length: ' + screenshotBase64.length + ')');

            const screenshotPath = path.join(__dirname, 'screenshot.png');
            // Delete if exists
            if (fs.existsSync(screenshotPath)) {
                fs.unlinkSync(screenshotPath);
            }
            await fs.promises.writeFile(screenshotPath, screenshotBase64, 'base64');
            console.log('Screenshot saved to:', screenshotPath);

        }catch {
            console.error("Failed to take:", err.message);
        }

    } catch (e) {
        console.error('Test execution failed:');
        console.error(e);
    } finally {
        if (client) {
            console.log('Deleting session...');
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main().catch(console.error);