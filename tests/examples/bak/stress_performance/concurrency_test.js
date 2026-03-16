const axios = require('axios');

// Configuration
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
        console.log(`Sending POST to ${hubUrl}/session to create session...`);
        const sessionRes = await axios.post(`${hubUrl}/session`, capabilities);

        if (sessionRes.data.value && sessionRes.data.value.sessionId) {
            sessionId = sessionRes.data.value.sessionId;
        } else if (sessionRes.data.sessionId) {
            sessionId = sessionRes.data.sessionId;
        } else {
            throw new Error('Failed to parse sessionId');
        }

        console.log(`Session created with ID: ${sessionId}`);

        // Send 100 concurrent requests
        const startTime = Date.now();
        console.log('Sending 100 concurrent getPageSource requests...');
        const promises = [];
        for (let i = 0; i < 100; i++) {
            const startRequestTime = Date.now();
            promises.push(
                axios.get(`${hubUrl}/session/${sessionId}/source`)
                    .then(() => console.log(`Request ${i + 1} completed in ${Date.now() - startRequestTime} ms`))
                    .catch((err) => console.error(`Request ${i + 1} failed: ${err.message}`))
            );
        }

        await Promise.all(promises);
        console.log('All requests finished.');
        const endTime = Date.now();
        console.log(`Total time taken: ${endTime - startTime} ms`);

        // Send 100 sequential requests
        const startTime2 = Date.now();
        console.log('Sending 100 sequential getPageSource requests...');
        for (let i = 0; i < 100; i++) {
            const startRequestTime = Date.now();
            await axios.get(`${hubUrl}/session/${sessionId}/source`)
                .then(() => console.log(`Request ${i + 1} completed in ${Date.now() - startRequestTime} ms`))
                .catch((err) => console.error(`Request ${i + 1} failed: ${err.message}`));
        }
        const endTime2 = Date.now();
        console.log(`Total time taken: ${endTime2 - startTime2} ms`);

        // Verify session is still alive by sending one more request
        console.log('Sending final verification request...');
        await axios.get(`${hubUrl}/session/${sessionId}/source`);
        console.log('Final request succeeded.');

    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        if (sessionId) {
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
