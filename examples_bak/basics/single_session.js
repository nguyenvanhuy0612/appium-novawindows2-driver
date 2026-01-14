// Start multiple sessions and send commands to each session
const { remote } = require('webdriverio');
const axios = require('axios');

async function main() {
    // Assuming port 4724 from running server, or 4723 if standard. The file implies 4723.
    // I will try to respect the file's setting but handle potential errors or update it.
    // Let's use the variable to be clean.
    const port = 4723;
    const sessionUrl = `http://127.0.0.1:${port}/session`;

    const wdioOpts = {
        hostname: '127.0.0.1',
        port: port,
        path: '/',
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root',
        },
        logLevel: 'error'
    };

    let client = null;
    let sessionId = null;

    try {
        console.log('Creating session 1...');
        client = await remote(wdioOpts);
        sessionId = client.sessionId;
        console.log(`Session 1 created: ${sessionId}`);

        // Workload helper
        const runWorkload = async (client, name, durationMs) => {
            console.log(`[${name}] Starting workload (${durationMs}ms)...`);
            const end = Date.now() + durationMs;
            let count = 0;

            while (Date.now() < end) {
                try {
                    // Run a lightweight command to verify concurrency without heavy load
                    // console.log(`[${name}] Running Get-Process...`);
                    const process = await client.execute('powerShell', 'Get-Process');
                    console.log(`[${name}] Process:`, process);
                    count++;
                } catch (e) {
                    if (e.message.includes('Session is either terminated') || e.message.includes('invalid session id')) {
                        console.log(`[${name}] Session terminated (expected if closed manually).`);
                        return;
                    }
                    console.error(`[${name}] Error:`, e.message);
                }
                // Short sleep to yield
                await new Promise(r => setTimeout(r, 100));
            }
            console.log(`[${name}] Completed. Requests: ${count}`);
        };

        // 1. Run concurrently
        const startTime = Date.now();
        console.log('--- Phase 1: Concurrent Execution ---');
        const task = runWorkload(client, 'Session', 10000); // 10s

        // Wait for Session workload to finish
        await task;

        console.log('Session finished safely.');
        console.log('Time taken:', Date.now() - startTime);

        // Get element from Session
        const process = await client.execute('powerShell', 'Get-Process');
        console.log('Process:', process);

        console.log('Time taken:', Date.now() - startTime);

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        if (sessionId) {
            console.log('Deleting session...');
            try { await client.deleteSession(); } catch (e) {
                // Fallback to axios if wdio object is stale/gone
                try { await axios.delete(`${sessionUrl}/${sessionId}`); } catch (x) { }
            }
            console.log('Session deleted.');
        }
    }
}

main();
