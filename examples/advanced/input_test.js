const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "platformName": "Windows",
            "appium:automationName": "NovaWindows2",
            "appium:app": "Root",
            "appium:isolatedScriptExecution": false,
            "appium:newCommandTimeout": 60
        },
        logLevel: 'error'
    };
    let client = null;
    try {
        client = await remote(opts);
        console.log('Session created:', client.sessionId);

        // Find and input text
        const element = client.$('[name="Text Editor"]');
        await element.addValue('Hello World\n');
        console.log('Text input:', await element.getText());
    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        if (client) {
            console.log('Deleting session...');
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main().catch(console.error);