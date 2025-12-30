const axios = require('axios');

async function main() {
    const sessionUrl = 'http://127.0.0.1:4723/session';
    let sessionId = null;

    try {
        console.log('Creating session...');
        const sessionResponse = await axios.post(sessionUrl, {
            capabilities: {
                alwaysMatch: {
                    platformName: 'Windows',
                    'appium:automationName': 'NovaWindows2',
                    'appium:app': 'Root',
                }
            }
        });
        sessionId = sessionResponse.data.value.sessionId;
        console.log(`Session created: ${sessionId}`);

        // 1. Send command that hangs for 70s
        console.log('Sending "Start-Sleep -Seconds 70" (simulated hang)...');
        console.log('Expectation: Should fail with TimeoutError after ~60s');

        const startTime = Date.now();
        try {
            await axios.post(`${sessionUrl}/${sessionId}/execute/sync`, {
                script: "powerShell",
                args: ["Start-Sleep -Seconds 70; Write-Output 'Done'"]
            }, {
                timeout: 75000 // Client timeout > server timeout
            });
            console.error('ERROR: Command succeeded but should have timed out!');
        } catch (error) {
            const elapsed = Date.now() - startTime;
            console.log(`Command failed as expected in ${elapsed}ms`);
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Data:', error.response.data);
            } else {
                console.log('Error:', error.message);
            }
        }

        // 2. Verify Session Recovered (New PowerShell process should start)
        console.log('Sending recovery check command "Get-Date"...');
        const recoverRes = await axios.post(`${sessionUrl}/${sessionId}/execute/sync`, {
            script: "powerShell",
            args: ["Get-Date"]
        });
        console.log('Recovery command success:', recoverRes.data.value ? 'Yes' : 'No');

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    } finally {
        if (sessionId) {
            console.log('Deleting session...');
            await axios.delete(`${sessionUrl}/${sessionId}`);
            console.log('Session deleted.');
        }
    }
}

main();
