const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        console.log("--- Testing XPath Functions ---");

        // 1. starts-with (Already verified, but good to keep)
        const startsWith = await driver.$$("//Window[starts-with(@Name, 'Task')]");
        console.log(`starts-with('Task'): Found ${startsWith.length} elements`);

        // 2. contains
        const contains = await driver.$$("//Window[contains(@Name, 'Shell')]");
        console.log(`contains('Shell'): Found ${contains.length} elements`);

        // 3. Logic AND
        const andLogic = await driver.$$("//Window[starts-with(@Name, 'Task') and contains(@Name, 'bar')]");
        console.log(`starts-with 'Task' AND contains 'bar': Found ${andLogic.length} elements`);

        // 4. Logic OR
        const orLogic = await driver.$$("//Window[@Name='Taskbar' or @Name='Program Manager']");
        console.log(`Name='Taskbar' OR Name='Program Manager': Found ${orLogic.length} elements`);

        // 5. Logic NOT
        const notLogic = await driver.$$("//Window[contains(@Name, 'Task') and not(@Name='Taskbar')]");
        console.log(`contains 'Task' AND NOT 'Taskbar': Found ${notLogic.length} elements (Expected 0 if Taskbar is the only one)`);

        // 6. string-length
        const len = await driver.$$("//Window[string-length(@Name) > 10]");
        console.log(`string-length > 10: Found ${len.length} elements`);

        // 7. translate (Case insensitive emulation)
        const translate = await driver.$$("//Window[contains(translate(@Name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'taskbar')]");
        console.log(`translate (case-insensitive 'taskbar'): Found ${translate.length} elements`);

        // 8. substring
        const sub = await driver.$$("//Window[substring(@Name, 1, 4) = 'Task']");
        console.log(`substring(@Name, 1, 4) = 'Task': Found ${sub.length} elements`);

        // 9. concat - usually used in equality, explicitly testing
        // Note: concat returns a string, so we compare it. 
        // "Task" + "bar" = "Taskbar"
        const concatTest = await driver.$$("//Window[@Name = concat('Task', 'bar')]");
        console.log(`concat('Task', 'bar') = 'Taskbar': Found ${concatTest.length} elements`);

        console.log("--- Test Complete ---");

    } catch (error) {
        console.error("XPath Test Failed:", error);
    } finally {
        await driver.deleteSession();
    }
}

main();
