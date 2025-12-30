const axios = require('axios');

async function main() {
    // const sessionUrl = 'http://127.0.0.1:4723/session';
    const sessionUrl = 'http://192.168.196.155:4723/session';
    let sessionId = null;

    try {
        // 1. Create Session
        console.log('Creating session...');
        const sessionResponse = await axios.post(sessionUrl, {
            capabilities: {
                alwaysMatch: {
                    "platformName": "Windows",
                    "appium:automationName": "NovaWindows2",
                    "appium:app": "Root",
                    "appium:newCommandTimeout": 60
                }
            }
        });

        sessionId = sessionResponse.data.value.sessionId;
        console.log(`Session created: ${sessionId}`);

        // // 2. Execute Command (Get-Date; exit 0)
        // console.log('Sending "Get-Date; exit 0;"...');
        // const executeUrl = `${sessionUrl}/${sessionId}/execute/sync`;
        // const payload = {
        //     script: "powerShell",
        //     args: ["Get-Date; exit 0;"]
        // };

        // const startTime = Date.now();
        // try {
        //     const response = await axios.post(executeUrl, payload);
        //     console.log('Response:', response.data);
        // } catch (error) {
        //     console.error('Request failed with status:', error.response.status);
        //     console.error('Data:', error.response.data);
        // }
        // const endTime = Date.now();
        // console.log(`Execution time: ${endTime - startTime} ms`);

        // 3. Execute extension command windows: click

        const element = await axios.get(`${sessionUrl}/${sessionId}/element`, {
            params: {
                using: 'xpath',
                value: '//*[@name="Windows Store"]'
            }
        });

        console.log('Sending "click"...');
        const clickUrl = `${sessionUrl}/${sessionId}/execute/sync`;
        const clickPayload = {
            script: "windows: click",
            args: [{
                elementId: element.data.value,
                button: 'right',
                modifierKeys: 'shift'
            }]
        };

        const clickStartTime = Date.now();
        try {
            const clickResponse = await axios.post(clickUrl, clickPayload);
            console.log('Click response:', clickResponse.data);
        } catch (error) {
            console.error('Click request failed with status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        const clickEndTime = Date.now();
        console.log(`Click execution time: ${clickEndTime - clickStartTime} ms`);

    } catch (error) {
        if (error.response) {
            console.error('Request failed with status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    } finally {
        // 3. Delete Session
        if (sessionId) {
            console.log('Deleting session...');
            try {
                await axios.delete(`${sessionUrl}/${sessionId}`);
                console.log('Session deleted.');
            } catch (ignore) {
                console.log('Failed to delete session (might be already closed).');
            }
        }
    }
}

main();
