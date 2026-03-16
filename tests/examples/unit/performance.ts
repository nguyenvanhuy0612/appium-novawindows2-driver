import { NovaWindows2Driver } from '../../lib/driver';
import { W3CDriverCaps } from '@appium/types';

async function main() {
    console.log("Initializing Driver...");
    let driver = null;

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

    const timeFunc = async (func: () => Promise<any>) => {
        const startTime = Date.now();
        const result = await func();
        const endTime = Date.now();
        console.log(`Time taken: ${endTime - startTime}ms`);
        return result;
    }

    try {
        console.log("Creating Driver...");
        driver = new NovaWindows2Driver({}, false); // false = skip validation
        console.log("Creating Session...");
        // Mocking createSession args: caps, reqCaps, w3cCaps
        await driver.createSession(caps as any, undefined, caps as any, []);
        console.log("Session Created. Driver attached.");

       const btns = await timeFunc(() => driver.findElOrEls('xpath', '//Button', true, undefined));
       console.log(`Found ${btns.length} buttons`);

    } catch (e) {
        console.error("Critical Error:", e);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

main();
