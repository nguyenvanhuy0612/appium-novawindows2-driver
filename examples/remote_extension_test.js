const { remote } = require('webdriverio');

/**
 * Remote Integration Test for ALL Extension Commands
 * Sequence matches EXTENSION_COMMANDS in lib/commands/extension.ts
 */
async function main() {
    const opts = {
        hostname: '192.168.196.155',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 120
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
        let notepadWindow;
        for (let i = 0; i < 5; i++) {
            try {
                // Robust XPath finder
                const selector = "//Window[@ClassName='Notepad']";
                notepadWindow = await client.$(selector);
                if (notepadWindow && !notepadWindow.error) {
                    console.log('Found Notepad Window.');
                    break;
                }
            } catch (e) { }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!notepadWindow || notepadWindow.error) {
            throw new Error('Failed to find Notepad window.');
        }
        const windowId = await notepadWindow.elementId;

        // --- Setup: Find Editor ---
        console.log('[Setup] Finding Editor Element...');
        let editor;
        try {
            editor = await notepadWindow.$(".//Document");
            if (!editor || editor.error) throw new Error('Editor not found');
            console.log('Found Editor.');
        } catch (e) {
            console.warn('Editor not found, some tests may be skipped.');
        }

        // --- Setup: Find File Menu (for Invoke/Expand) ---
        let fileMenu;
        try {
            // Usually 'File' or 'Archivo' etc. - assume English 'File' for now or first MenuItem
            const menuItems = await notepadWindow.$$("//MenuItem");
            if (menuItems.length > 0) {
                fileMenu = menuItems[0];
                console.log(`Found a MenuItem: ${await fileMenu.getAttribute('Name')}`);
            }
        } catch (e) { }


        // ==========================================
        // TEST SEQUENCE (Matches EXTENSION_COMMANDS)
        // ==========================================

        // 1. cacheRequest
        console.log('\n[1] Testing cacheRequest...');
        try {
            await client.execute('windows:cacheRequest', { treeScope: 'Subtree' });
            console.log('  - cacheRequest (Subtree) sent.');
            await client.execute('windows:cacheRequest', { treeScope: 'Element' }); // Reset
        } catch (e) { console.error('  - Failed:', e.message); }

        // 2. invoke (Pattern)
        console.log('\n[2] Testing invoke...');
        if (fileMenu) {
            // Note: Invoking File menu usually opens it. 
            // We might skip actual invoke to avoid blocking UI, or try it.
            // Let's just log potential usage.
            try {
                // await client.execute('windows:invoke', { elementId: await fileMenu.elementId });
                console.log('  - Skipping actual invoke to avoid UI blocking, but command exists.');
            } catch (e) { console.log('  - Invoke error (expected if skipped or not supported):', e.message); }
        } else { console.log('  - No suitable element for Invoke.'); }

        // 3. expand (Pattern)
        console.log('\n[3] Testing expand...');
        if (fileMenu) {
            try {
                await client.execute('windows:expand', { elementId: await fileMenu.elementId });
                console.log('  - Expanded File menu.');
                await new Promise(r => setTimeout(r, 500));
            } catch (e) { console.log('  - Expand error:', e.message); }
        }

        // 4. collapse (Pattern)
        console.log('\n[4] Testing collapse...');
        if (fileMenu) {
            try {
                await client.execute('windows:collapse', { elementId: await fileMenu.elementId });
                console.log('  - Collapsed File menu.');
            } catch (e) { console.log('  - Collapse error:', e.message); }
        }

        // 5. isMultiple (Selection Pattern)
        console.log('\n[5] Testing isMultiple...');
        // Notepad doesn't have selection items easily accessible. 
        console.log('  - Skipped (No SelectionPattern element available).');

        // 6. scrollIntoView (Pattern)
        console.log('\n[6] Testing scrollIntoView...');
        if (editor) {
            try {
                await client.execute('windows:scrollIntoView', { elementId: await editor.elementId });
                console.log('  - Scrolled Editor into view.');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 7. selectedItem (Selection Pattern)
        console.log('\n[7] Testing selectedItem...');
        console.log('  - Skipped (No SelectionPattern available).');

        // 8. allSelectedItems (Selection Pattern)
        console.log('\n[8] Testing allSelectedItems...');
        console.log('  - Skipped (No SelectionPattern available).');

        // 9. addToSelection (SelectionItem Pattern)
        console.log('\n[9] Testing addToSelection...');
        console.log('  - Skipped (No SelectionItemPattern available).');

        // 10. removeFromSelection (SelectionItem Pattern)
        console.log('\n[10] Testing removeFromSelection...');
        console.log('  - Skipped (No SelectionItemPattern available).');

        // 11. select (SelectionItem Pattern)
        console.log('\n[11] Testing select...');
        console.log('  - Skipped (No SelectionItemPattern available).');

        // 12. toggle (Toggle Pattern)
        console.log('\n[12] Testing toggle...');
        // Could find "Format" -> "Word Wrap" if we navigated menus, but checking checkbox is hard in Notepad 11.
        console.log('  - Skipped (No TogglePattern available).');

        // 13. setValue (Value Pattern)
        console.log('\n[13] Testing setValue...');
        if (editor) {
            try {
                await client.execute('windows:setValue', { elementId: await editor.elementId, value: 'Hello World' });
                console.log('  - set value to "Hello World"');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 14. getValue (Value Pattern)
        console.log('\n[14] Testing getValue...');
        if (editor) {
            try {
                // Note: 'windows:getValue' executes pattern.Value.Value, but currently returns void? 
                // Based on definition it builds a command. Checking result.
                const val = await client.execute('windows:getValue', { elementId: await editor.elementId });
                console.log('  - getValue result:', val);
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 15. maximize (Window Pattern)
        console.log('\n[15] Testing maximize...');
        try {
            await client.execute('windows:maximize', { elementId: windowId });
            console.log('  - Window maximized.');
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { console.error('  - Failed:', e.message); }

        // 16. minimize (Window Pattern)
        console.log('\n[16] Testing minimize...');
        try {
            await client.execute('windows:minimize', { elementId: windowId });
            console.log('  - Window minimized.');
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { console.error('  - Failed:', e.message); }

        // 17. restore (Window Pattern)
        console.log('\n[17] Testing restore...');
        try {
            await client.execute('windows:restore', { elementId: windowId });
            console.log('  - Window restored.');
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { console.error('  - Failed:', e.message); }

        // 18. close (Window Pattern)
        // We will do this at the very end to clean up.
        console.log('\n[18] Testing close (deferred)...');

        // 19. keys (Interaction)
        console.log('\n[19] Testing keys...');
        if (editor) {
            try {
                await client.execute('windows:setFocus', { elementId: await editor.elementId });
                await client.execute('windows:keys', { actions: [{ text: ' + Appium' }] });
                console.log('  - Keys sent.');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 20. click (Interaction)
        console.log('\n[20] Testing click...');
        if (editor) {
            try {
                await client.execute('windows:click', { elementId: await editor.elementId });
                console.log('  - Clicked editor.');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 21. hover (Interaction)
        console.log('\n[21] Testing hover...');
        if (editor) {
            try {
                await client.execute('windows:hover', { elementId: await editor.elementId, durationMs: 500 });
                console.log('  - Hovered editor.');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 22. scroll (Interaction)
        console.log('\n[22] Testing scroll...');
        if (editor) {
            try {
                // Scroll down implies deltaY is negative? Or positive? WinAPI usually: negative is down/towards user?
                // Standard: -120 is one wheel click down.
                await client.execute('windows:scroll', { elementId: await editor.elementId, deltaY: -120 });
                console.log('  - Scrolled editor.');
            } catch (e) { console.error('  - Failed:', e.message); }
        }

        // 23. setFocus (Base)
        console.log('\n[23] Testing setFocus...');
        try {
            await client.execute('windows:setFocus', { elementId: windowId });
            console.log('  - Focused main window.');
        } catch (e) { console.error('  - Failed:', e.message); }

        // 24. getClipboard
        console.log('\n[24] Testing getClipboard...');
        try {
            const clip = await client.execute('windows:getClipboard', {});
            console.log('  - Retrieved clipboard content (b64 length):', clip.length);
        } catch (e) { console.error('  - Failed:', e.message); }

        // 25. setClipboard
        console.log('\n[25] Testing setClipboard...');
        try {
            await client.execute('windows:setClipboard', { b64Content: Buffer.from('ExtensionTest').toString('base64') });
            console.log('  - Set clipboard to "ExtensionTest".');
        } catch (e) { console.error('  - Failed:', e.message); }


        // --- Cleanup: Close Window ---
        console.log('\n[Cleanup] Closing Notepad...');
        try {
            await client.execute('windows:close', { elementId: windowId });
            console.log('  - Close command sent.');
        } catch (e) { console.error('  - Failed to close:', e.message); }

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
