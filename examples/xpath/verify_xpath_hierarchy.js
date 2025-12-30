const webdriverio = require('webdriverio');

const opts = {
    hostname: '127.0.0.1',
    port: 4726,
    capabilities: {
        platformName: "Windows",
        "appium:automationName": "NovaWindows2",
        "appium:app": "Root",
        "appium:useNativeUia": true,
        "appium:newCommandTimeout": 3600,
    }
};

async function main() {
    console.log("Initializing session...");
    const client = await webdriverio.remote(opts);
    console.log("Session initialized.");

    try {
        // Test 1: Absolute path to direct child (Taskbar is usually a Pane)
        console.log("--- Test 1: /Pane ---");
        try {
            const taskbar = await client.$('/Pane');
            console.log("Found element:", taskbar.elementId);
            const rect = await taskbar.getSize();
            console.log("Size:", rect);
        } catch (e) { console.log("Failed:", e.message); }


        // Test 2: Hierarchical path /Pane/Button[1] (Direct child assumption check)
        // Note: Start button might NOT be a direct child of Shell_TrayWnd on all Windows versions.
        console.log("--- Test 2: /Pane/Button[1] ---");
        try {
            const btn = await client.$('/Pane/Button[1]');
            console.log("Found element:", btn.elementId);
            const rect = await btn.getSize();
            console.log("Size:", rect);
        } catch (e) { console.log("Failed:", e.message); }

        // Test 3: Descendant path /Pane//Button[1] (Double slash)
        // This should find the first button ANYWHERE under the Pane (Taskbar)
        console.log("--- Test 3: /Pane//Button[1] ---");
        try {
            const btnDesc = await client.$('/Pane//Button[1]');
            console.log("Found element:", btnDesc.elementId);
            const rect = await btnDesc.getSize();
            console.log("Size:", rect);
        } catch (e) { console.log("Failed:", e.message); }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.deleteSession();
    }
}

main();
