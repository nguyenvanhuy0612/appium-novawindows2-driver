
async function main() {
    const log = (msg) => console.log(`[FunctionalTest] ${msg}`);
    const baseUrl = 'http://127.0.0.1:4723';
    let sessionId = null;

    async function request(method, endpoint, body = null) {
        const url = `${baseUrl}${endpoint}`;
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);

        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Request failed: ${res.status} ${res.statusText} - ${text}`);
            }
            return await res.json();
        } catch (err) {
            throw new Error(`Fetch error ${url}: ${err.message}`);
        }
    }

    try {
        log('Initializing Session...');
        const sessionRes = await request('POST', '/session', {
            capabilities: {
                alwaysMatch: {
                    platformName: 'Windows',
                    'appium:automationName': 'NovaWindows2',
                    'appium:app': 'Root',
                    'appium:newCommandTimeout': 3600
                }
            }
        });

        sessionId = sessionRes.value.sessionId;
        log(`Session created: ${sessionId}`);

        // 1. Get Window Rect
        log('Testing: getWindowRect...');
        const rectRes = await request('GET', `/session/${sessionId}/window/rect`);
        log(`Window Rect: ${JSON.stringify(rectRes.value)}`);

        // 2. Get Page Source
        log('Testing: getPageSource...');
        const start = Date.now();
        const sourceRes = await request('GET', `/session/${sessionId}/source`);
        const duration = Date.now() - start;
        log(`Page Source retrieved in ${duration}ms (length: ${sourceRes.value.length})`);

        // 3. Find Elements (Find All)
        log('Testing: findElements (xpath //*)...');
        const findRes = await request('POST', `/session/${sessionId}/elements`, {
            using: 'xpath',
            value: '//*'
        });
        const elements = findRes.value;
        log(`Found ${elements.length} elements.`);

        if (elements.length > 0) {
            // Pick a few random elements to test individual property retrieval
            const count = Math.min(elements.length, 5);
            const selected = elements.slice(0, count); // First 5

            for (let i = 0; i < selected.length; i++) {
                const elFn = selected[i];
                const elId = Object.values(elFn)[0]; // Extract element ID
                log(`--- Inspecting Element ${i + 1}/${count} (ID: ${elId}) ---`);

                // 4. Get Element Rect
                try {
                    const elRectRes = await request('GET', `/session/${sessionId}/element/${elId}/rect`);
                    log(`   Rect: ${JSON.stringify(elRectRes.value)}`);
                } catch (e) {
                    log(`   Failed to get rect: ${e.message}`);
                }

                // 5. Get Attribute / Property (using 'Name')
                // Note: W3C standard uses /attribute/:name. Appium often maps this.
                try {
                    const nameRes = await request('GET', `/session/${sessionId}/element/${elId}/attribute/Name`);
                    log(`   Name: "${nameRes.value}"`);
                } catch (e) {
                    log(`   Failed to get Name: ${e.message}`);
                }

                try {
                    const typeRes = await request('GET', `/session/${sessionId}/element/${elId}/attribute/ControlType`);
                    log(`   ControlType: "${typeRes.value}"`);
                } catch (e) {
                    log(`   Failed to get ControlType: ${e.message}`);
                }

                // 6. Get Text
                try {
                    const textRes = await request('GET', `/session/${sessionId}/element/${elId}/text`);
                    log(`   Text: "${textRes.value}"`);
                } catch (e) {
                    log(`   Failed to get text: ${e.message}`);
                }

                // 7. Check Displayed/Enabled
                try {
                    const dispRes = await request('GET', `/session/${sessionId}/element/${elId}/displayed`);
                    const enRes = await request('GET', `/session/${sessionId}/element/${elId}/enabled`);
                    log(`   Displayed: ${dispRes.value}, Enabled: ${enRes.value}`);
                } catch (e) {
                    log(`   Failed to check state: ${e.message}`);
                }
            }
        }

        // 8. Screenshot
        log('Testing: takeScreenshot...');
        const screenRes = await request('GET', `/session/${sessionId}/screenshot`);
        log(`Screenshot taken (length: ${screenRes.value.length})`);

        log('Test Completed Successfully.');

    } catch (err) {
        log(`CRITICAL ERROR: ${err.message}`);
        console.error(err);
    } finally {
        if (sessionId) {
            try {
                await request('DELETE', `/session/${sessionId}`);
                log('Session deleted.');
            } catch (e) {
                log(`Failed to delete session: ${e.message}`);
            }
        }
    }
}

main();
