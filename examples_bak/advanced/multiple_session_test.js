// Start multiple sessions and send commands to each session
const { remote } = require('webdriverio');
const axios = require('axios');

async function main() {
    const options = {
        hostname: '192.168.196.155', // User designated IP
        port: 4723,
        capabilities: {
            platformName: 'Windows',
            'appium:automationName': 'NovaWindows2',
            'appium:app': 'Root'
        },
        logLevel: 'error'
    };

    // Construct sessionUrl for cleanup
    const sessionUrl = `http://${options.hostname}:${options.port}/session`;

    let client1 = null;
    let client2 = null;
    let sessionId1 = null;
    let sessionId2 = null;

    try {
        console.log('Creating session 1...');
        client1 = await remote(options);
        sessionId1 = client1.sessionId;
        console.log(`Session 1 created: ${sessionId1}`);

        console.log('Creating session 2...');
        client2 = await remote(options);
        sessionId2 = client2.sessionId;
        console.log(`Session 2 created: ${sessionId2}`);

        // Workload helper
        const runWorkload = async (client, name, durationMs) => {
            console.log(`[${name}] Starting workload (${durationMs}ms)...`);
            const end = Date.now() + durationMs;
            let count = 0;

            while (Date.now() < end) {
                try {
                    const process = await client.execute('powerShell', 'Get-Process');
                    // Truncate process output to avoid console spam
                    const processStr = process.toString();
                    console.log(`[${name}] Process output length: ${processStr.length}`);

                    const buttons = await client.findElements('xpath', '//Button');
                    console.log(`[${name}] Buttons found: ${buttons.length}`);
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
        const task1 = runWorkload(client1, 'Session 1', 10000); // 10s
        const task2 = runWorkload(client2, 'Session 2', 4000);  // 4s

        // Wait for Session 2 workload to finish
        await task2;

        // 2. Close Session 2 while Session 1 is still running
        console.log('--- Phase 2: Closing Session 2 while Session 1 runs ---');
        console.log('Deleting session 2...');
        await client2.deleteSession();
        sessionId2 = null; // Prevent double delete in finally
        console.log('Session 2 deleted.');

        // Verify Session 1 is still alive and working
        console.log('Verifying Session 1 is still running...');
        await task1; // Wait for the remaining time of S1

        console.log('Session 1 finished safely.');
        console.log('Time taken:', Date.now() - startTime);

        // Get element from Session 1
        const process = await client1.execute('powerShell', 'Get-Process');
        console.log('Final Process output length:', process.length);

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        if (sessionId1) {
            console.log('Deleting session 1...');
            try { await client1.deleteSession(); } catch (e) {
                // Fallback to axios if wdio object is stale/gone
                try { await axios.delete(`${sessionUrl}/${sessionId1}`); } catch (x) { }
            }
            console.log('Session 1 deleted.');
        }
        if (sessionId2) {
            console.log('Deleting session 2...');
            try { await client2.deleteSession(); } catch (e) {
                try { await axios.delete(`${sessionUrl}/${sessionId2}`); } catch (x) { }
            }
            console.log('Session 2 deleted.');
        }
    }
}

main();
