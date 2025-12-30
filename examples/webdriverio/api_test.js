const axios = require('axios');

// Configuration
// Appium 2.x defaults to no base path. If you are using Appium 1.x or have configured a base path, add it here (e.g., http://.../wd/hub)
const hubUrl = 'http://192.168.196.155:4723';

const capabilities = {
    "capabilities": {
        "alwaysMatch": {
            "platformName": "Windows",
            "appium:automationName": "NovaWindows2",
            "appium:app": "Root"
        }
    }
};
                   
async function runTest() {
    let sessionId;
    try {
        // 1. Create Session
        console.log(`Sending POST to ${hubUrl}/session to create session...`);
        const sessionRes = await axios.post(`${hubUrl}/session`, capabilities);

        // Appium sends sessionId in `value.sessionId` (W3C) or just `sessionId` (JSONWP)
        if (sessionRes.data.value && sessionRes.data.value.sessionId) {
            sessionId = sessionRes.data.value.sessionId;
        } else if (sessionRes.data.sessionId) {
            sessionId = sessionRes.data.sessionId;
        } else {
            throw new Error('Failed to parse sessionId from response: ' + JSON.stringify(sessionRes.data));
        }

        console.log(`Session created with ID: ${sessionId}`);

        // 2. Get Page Source
        console.log(`Sending GET to ${hubUrl}/session/${sessionId}/source to get page source...`);
        const sourceRes = await axios.get(`${hubUrl}/session/${sessionId}/source`);
        const source = sourceRes.data.value; // W3C standard response structure { value: ... }

        console.log('--- Page Source Start ---');
        console.log(source);
        console.log('--- Page Source End ---');

    } catch (error) {
        console.error('Error occurred:');
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
            if (error.response.status === 404) {
                console.error('Hint: The Appium server might be using a different base path (e.g., /wd/hub). Check your server configuration.');
            }
        } else {
            console.error(error.message);
        }
    } finally {
        if (sessionId) {
            // 3. Delete Session
            try {
                console.log(`Deleting session ${sessionId}...`);
                await axios.delete(`${hubUrl}/session/${sessionId}`);
                console.log('Session deleted.');
            } catch (delErr) {
                console.error('Failed to delete session:', delErr.message);
            }
        }
    }
}

runTest();
