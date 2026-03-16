const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 03_finding_elements.js (Enhanced) ---');
    let driver;
    try {

        // ---------------------------------------------------------
        // Scenario A: Default Behavior (convertAbsoluteXPath = true)
        // ---------------------------------------------------------
        console.log('\n[Scenario A] Default: convertAbsoluteXPathToRelativeFromElement = true');
        driver = await createDriver(); // Default caps

        // 1. Standard XPath (Replacing ~Start with XPath)
        console.log('1. Finding by XPath (//*[@Name="Start"])...');
        try {
            const startBtn = await driver.$('//*[@Name="Start"]');
            console.log('   Found Start button.');
        } catch (e) { console.log('   Start button not found.'); }

        // 2. Element from Element (Nested)
        console.log('2. Nested Search (Taskbar -> Start)...');
        try {
            const taskbar = await driver.$('//*[@ClassName="Shell_TrayWnd"]');
            // Because of the capability, absolute path starting with / here might be converted 
            // if we used it, but standard practice for nested is .//
            const startBtnNested = await taskbar.$('.//*[@Name="Start"]');
            console.log('   Found Start button inside Taskbar.');
        } catch (e) {
            console.log('   Nested search failed: ' + e.message);
        }

        // 3. Absolute XPath Test
        console.log('3. Absolute XPath (should work and NOT fail on Root session)...');
        try {
            // Even though we are on Root, searching for a top level window via / should be precise.
            // The cap implies that / becomes .// relative to the "Root" element if bound to main window?
            // Actually on Root session, context IS Root.
            const windows = await driver.$$('/Window');
            console.log(`   Found ${windows.length} top-level windows via /Window.`);
        } catch (e) {
            console.log('   Absolute XPath search failed: ' + e.message);
        }

        await driver.deleteSession();

        // ---------------------------------------------------------
        // Scenario B: convertAbsoluteXPathToRelativeFromElement = false
        // ---------------------------------------------------------
        console.log('\n[Scenario B] convertAbsoluteXPathToRelativeFromElement = false');
        driver = await createDriver({
            capabilities: {
                "appium:convertAbsoluteXPathToRelativeFromElement": false
            }
        });

        console.log('1. Finding element from element using Absolute path (Strict)...');
        try {
            const taskbar = await driver.$('//*[@ClassName="Shell_TrayWnd"]');
            // If we try to find a child using an absolute path '/Button', it should strictly 
            // look from the root if not converted, OR fail if the driver implies context.
            // This test verifies that the flag changes behavior involving leading slashes.
            const result = await taskbar.$('/Button');
            console.log('   Found/Tried (Behavior check).');
        } catch (e) {
            console.log('   Expected failure or diff behavior: ' + e.message);
        }

        await driver.deleteSession();

    } catch (err) {
        console.error('Error:', err);
    }
}

if (require.main === module) {
    main();
}
