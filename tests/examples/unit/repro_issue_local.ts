import { NovaWindows2Driver } from '../../lib/driver';
import { W3CDriverCaps } from '@appium/types';

async function main() {
    console.log("Initializing Driver...");
    const driver = new NovaWindows2Driver({}, false); // false = skip validation

    // Capabilities
    const caps: W3CDriverCaps = {
        alwaysMatch: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'C:\\Windows\\explorer.exe',
            // 'appium:app': 'Root', // Uncomment to test Root mode
            'appium:includeContextElementInSearch': true,
            'appium:newCommandTimeout': 3600
        }
    };

    try {
        console.log("Creating Session...");
        // Mocking createSession args: caps, reqCaps, w3cCaps
        await driver.createSession(caps as any, undefined, caps as any, []);
        console.log("Session Created. Driver attached.");

        // Reproduction Step
        // User Path: /Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]
        // This is extremely specific to the user's machine state, but /Window should be findable at least.
        const selector = '/Window';
        console.log(`Attempting to find element with XPath: ${selector}`);
        try {
            const el = await driver.findElOrEls('xpath', selector, false, undefined);
            console.log("Success! Element found:", el);
        } catch (e) {
            console.error("FAIL: Element not found or error:", e);
        }

        // Try the full path if /Window works
        const fullSelector = '/Window/Pane[2]/Pane/Pane/Pane/Pane/Button[2]';
        console.log(`Attempting to find full path: ${fullSelector}`);
        try {
            const el = await driver.findElOrEls('xpath', fullSelector, false, undefined);
            console.log("Success! Full path element found:", el);
        } catch (e) {
            console.log("Full path failed (expected if UI differs):", e);
        }

        // Clean up
        await driver.deleteSession();

    } catch (e) {
        console.error("Critical Error:", e);
    }
}

main();
