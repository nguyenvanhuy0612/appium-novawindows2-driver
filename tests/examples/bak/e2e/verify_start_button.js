const remote = require('webdriverio').remote;
const path = require('path');

const opts = {
    hostname: '192.168.8.245',
    port: 4723,
    path: '/',
    capabilities: {
        "platformName": "windows",
        "appium:automationName": "NovaWindows2",
        "appium:app": "Root",
        "appium:newCommandTimeout": 240000
    }
};

async function main() {
    const driver = await remote(opts);
    try {
        console.log("Session created. Finding Start button...");

        // Find Start button by Name (localized to EN-US usually 'Start')
        const startBtn = await driver.$("//*[@Name='Start']");

        console.log("Start button found:");
        console.log("  AutomationId: " + await startBtn.getAttribute("AutomationId"));
        console.log("  Name: " + await startBtn.getText());

        const props = [
            "LegacyIAccessible.Name",
            "LegacyIAccessible.Role",
            "LegacyIAccessible.State",
            "LegacyIAccessible.DefaultAction",
            "Value.Value" // Should be empty/null but good to check
        ];

        for (const p of props) {
            let val = "Error";
            try {
                val = await startBtn.getAttribute(p);
            } catch (e) {
                val = "EXCEPTION: " + e.message;
            }
            console.log(`  ${p}: '${val}'`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await driver.deleteSession();
    }
}

main();
