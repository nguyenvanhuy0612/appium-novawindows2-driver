const { remote } = require('webdriverio');

/**
 * Remote Integration Test for ALL Extension Commands
 * Sequence matches EXTENSION_COMMANDS in lib/commands/extension.ts
 */
const W3C_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';

async function main() {
    const opts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 3600
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        // --- Setup: Launch Notepad ---
        console.log('\n[Setup] Launching Notepad...');
        try { await client.execute('powerShell', 'taskkill /f /im notepad.exe') } catch (e) { }
        await client.execute('powerShell', 'Start-Process notepad');
        await new Promise(r => setTimeout(r, 2000));

        // --- Setup: Find Window ---
        console.log('[Setup] Finding Notepad Window...');
        let window = await client.$("//Window[@ClassName='Notepad']");
        console.log('Found window:', window);

        // Find Editor
        let editor = await window.$("//Document[@Name='Text Editor']");
        console.log('Found editor:', editor);

        // ==========================================
        // TEST SEQUENCE (Matches EXTENSION_COMMANDS)
        // ==========================================

        // 6. scrollIntoView (Pattern)
        console.log('\n[6] Testing scrollIntoView...');
        const explorer = await client.$("//*[@Name='ConsoleListener.py']");
        const explorerId = await explorer[W3C_ELEMENT_KEY];
        await client.execute('windows:scrollIntoView', { elementId: explorerId });
        console.log('  - Scrolled Editor into view.');

        // 13. setValue (Value Pattern)
        console.log('\n[13] Testing setValue...');
        const editorId = await editor[W3C_ELEMENT_KEY];
        await client.execute('windows:setValue', { elementId: editorId, value: 'Hello World' });
        console.log('  - set value to "Hello World"');

        // 14. getValue (Value Pattern)
        console.log('\n[14] Testing getValue...');
        const val = await client.execute('windows:getValue', { elementId: editorId });
        console.log('  - getValue result:', val);

        // 15. maximize (Window Pattern)
        console.log('\n[15] Testing maximize...');
        const windowId = await window[W3C_ELEMENT_KEY];
        await client.execute('windows:maximize', { elementId: windowId });
        console.log('  - Window maximized.');
        await new Promise(r => setTimeout(r, 1000));

        // 16. minimize (Window Pattern)
        console.log('\n[16] Testing minimize...');
        await client.execute('windows:minimize', { elementId: windowId });
        console.log('  - Window minimized.');
        await new Promise(r => setTimeout(r, 1000));

        // 17. restore (Window Pattern)
        console.log('\n[17] Testing restore...');
        await client.execute('windows:restore', { elementId: windowId });
        console.log('  - Window restored.');
        await new Promise(r => setTimeout(r, 1000));

        // 18. close (Window Pattern)
        // We will do this at the very end to clean up.
        console.log('\n[18] Testing close (deferred)...');

        // 19. keys (Interaction)
        console.log('\n[19] Testing keys...');
        await client.execute('windows:setFocus', { elementId: editorId });
        await client.execute('windows:keys', { actions: [{ text: ' + Appium' }] });
        console.log('  - Keys sent.');

        // 20. click (Interaction)
        console.log('\n[20] Testing click...');
        if (editor) {
            await client.execute('windows:click', { elementId: editorId });
            console.log('  - Clicked editor.');
        }

        // 21. hover (Interaction)
        console.log('\n[21] Testing hover...');
        if (editor) {
            await client.execute('windows:hover', { elementId: editorId, durationMs: 500 });
            console.log('  - Hovered editor.');
        }

        // 22. scroll (Interaction)
        console.log('\n[22] Testing scroll...');
        if (editor) {
            await client.execute('windows:scroll', { elementId: editorId, deltaY: -120 });
            console.log('  - Scrolled editor.');
        }

        // 23. setFocus (Base)
        console.log('\n[23] Testing setFocus...');
        await client.execute('windows:setFocus', { elementId: windowId });
        console.log('  - Focused main window.');

        // 24. setClipboard
        console.log('\n[24] Testing setClipboard...');
        await client.execute('windows:setClipboard', { b64Content: Buffer.from('ExtensionTest').toString('base64') });
        console.log('  - Set clipboard to "ExtensionTest".');

        // 25. getClipboard
        console.log('\n[25] Testing getClipboard...');
        const clip = await client.execute('windows:getClipboard', {});
        console.log('  - Retrieved clipboard content (b64 length):', clip.length);

        // --- Cleanup: Close Window ---
        console.log('\n[Cleanup] Closing Notepad...');
        await client.execute('windows:close', { elementId: windowId });
        console.log('  - Close command sent.');
    } catch (err) {
        console.error('CRITICAL TEST FAILURE:', err);
    } finally {
        if (client) {
            await client.deleteSession();
            console.log('Session deleted.');
        }
    }
}

main();
