const axios = require('axios');

const HOST = process.env.APPIUM_HOST || '127.0.0.1';
const PORT = process.env.APPIUM_PORT || '4723';
const BASE_URL = `http://${HOST}:${PORT}`;

async function main() {
    console.log('--- 01_raw_session.js (Axios) ---');
    let sessionId = null;

    try {
        // 1. Create Session
        console.log(`Connecting to ${BASE_URL}/session...`);
        const sessionResponse = await axios.post(`${BASE_URL}/session`, {
            capabilities: {
                alwaysMatch: {
                    "platformName": "Windows",
                    "appium:automationName": "NovaWindows2",
                    "appium:app": "Root",
                    "appium:newCommandTimeout": 3600
                }
            }
        });

        if (!sessionResponse.data.value) {
            throw new Error('Failed to create session: No value in response');
        }

        sessionId = sessionResponse.data.value.sessionId;
        console.log(`Session Created. ID: ${sessionId}`);

        // 2. Get Sessions List
        // console.log('Getting active sessions...');
        // const sessions = await axios.get(`${BASE_URL}/sessions`);
        // console.log('Active sessions:', sessions.data.value);

        // 3. Find Element (Root/Desktop) via XPath
        console.log('Finding element (Start button)...');
        const findRes = await axios.post(`${BASE_URL}/session/${sessionId}/element`, {
            using: 'accessibility id',
            value: 'Start'
        });

        // Note: W3C Element ID is usually in values[element-6066-11e4-a52e-4f735466cecf]
        // But axios returns the JSON body.
        const elementId = Object.values(findRes.data.value)[0];
        console.log(`Found Start button. Element ID: ${elementId}`);

        // 4. Get Attribute via Raw HTTP
        console.log(`Getting 'Name' attribute for element ${elementId}...`);
        const attrRes = await axios.get(`${BASE_URL}/session/${sessionId}/element/${elementId}/attribute/Name`);
        console.log(`Attribute Name: ${attrRes.data.value}`);

        // 5. Take Screenshot
        console.log('Taking screenshot via raw HTTP...');
        const screenRes = await axios.get(`${BASE_URL}/session/${sessionId}/screenshot`);
        const base64Len = screenRes.data.value.length;
        console.log(`Screenshot captured (${base64Len} chars).`);

    } catch (err) {
        if (err.response) {
            console.error(`HTTP Error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
        } else {
            console.error('Error:', err.message);
        }
    } finally {
        // 6. Delete Session
        if (sessionId) {
            console.log('Deleting session...');
            try {
                await axios.delete(`${BASE_URL}/session/${sessionId}`);
                console.log('Session deleted.');
            } catch (delErr) {
                console.error('Failed to delete session:', delErr.message);
            }
        }
    }
}

main();
