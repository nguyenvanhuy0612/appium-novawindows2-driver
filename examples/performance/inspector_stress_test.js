const axios = require('axios');

async function main() {
    const sessionUrl = 'http://127.0.0.1:4723/session';
    let sessionId = null;

    try {
        // 1. Create Session
        console.log('Creating session...');
        const start = Date.now();
        const sessionResponse = await axios.post(sessionUrl, {
            capabilities: {
                alwaysMatch: {
                    platformName: 'Windows',
                    'appium:automationName': 'NovaWindows2',
                    'appium:app': 'Root',
                    'appium:connectHardwareKeyboard': true
                }
            }
        });
        sessionId = sessionResponse.data.value.sessionId;
        console.log(`Session created: ${sessionId} in ${Date.now() - start}ms`);

        // 2. Simulate Appium Inspector behavior
        // Appium Inspector typically gets the page source, then finds elements and gets their attributes.
        // We will loop findElement and getAttribute to stress the queue.

        // 2. Discover a valid element
        console.log('getting page source to find a valid element...');
        const sourceRes = await axios.get(`${sessionUrl}/${sessionId}/source`);
        const source = sourceRes.data.value;

        // Simple regex to find a name attribute
        // const match = source.match(/Name="([^"]+)"/);
        // if (!match) {
        //     console.error('Could not find any element with a Name attribute in page source.');
        //     return;
        // }
        // const validName = match[1];
        // console.log(`Found valid element name: "${validName}"`);
        // const xpath = `//*[@Name="${validName}"]`;

        const iter = 50; // Number of iterations
        const validName = "Root";
        console.log(`Starting stress test with ${iter} iterations on "${validName}"...`);

        // Find root element
        const xpath = '/*';

        // Find an element that definitely exists (Root -> Taskbar or similar)
        // Adjust XPath as needed for a generic Windows environment
        // const xpath = '//*[@Name="Taskbar"]';

        for (let i = 0; i < iter; i++) {
            const iterStart = Date.now();
            console.log(`[${i}] Finding element...`);

            try {
                // Find Element
                const findRes = await axios.post(`${sessionUrl}/${sessionId}/element`, {
                    using: 'xpath',
                    value: xpath
                });

                if (findRes.data.value && findRes.data.value.error) {
                    console.error(`[${i}] Find Element Error:`, findRes.data.value.error);
                    continue;
                }

                const elementId = findRes.data.value[Object.keys(findRes.data.value)[0]]; // Extract Element ID

                // Get Attribute (Name)
                console.log(`[${i}] Getting attribute for ${elementId}...`);
                await axios.get(`${sessionUrl}/${sessionId}/element/${elementId}/attribute/Name`);

                // Get Attribute (RuntimeId) 
                // Using property might be faster, but let's mix it up
                // await axios.get(`${sessionUrl}/${sessionId}/element/${elementId}/attribute/RuntimeId`);

            } catch (e) {
                console.error(`[${i}] Request failed:`, e.message);
                if (e.response) {
                    console.error('Data:', e.response.data);
                }
            }
            console.log(`[${i}] Completed in ${Date.now() - iterStart}ms`);
        }

    } catch (error) {
        if (error.response) {
            console.error('Session setup failed:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
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
