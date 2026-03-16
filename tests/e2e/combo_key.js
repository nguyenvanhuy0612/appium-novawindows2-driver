const webdriver = require('webdriverio');

const opts = {
    hostname: '192.168.8.245',
    port: 4723,
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
        'appium:newCommandTimeout': 30,
    },
    logLevel: 'info',
};

(async () => {
    const driver = await webdriver.remote(opts);

    try {
        console.log('Session started');

        // Define keys
        const WIN_KEY = '\uE03D';
        const LEFT_ARROW = '\uE012';

        console.log('Sending Windows + Left Arrow combination...');

        // Perform Window + Left Arrow
        await driver.performActions([
            {
                type: 'key',
                id: 'keyboard',
                actions: [
                    { type: 'keyDown', value: WIN_KEY },
                    { type: 'keyDown', value: LEFT_ARROW },
                    { type: 'pause', duration: 100 },
                    { type: 'keyUp', value: LEFT_ARROW },
                    { type: 'keyUp', value: WIN_KEY },
                ],
            },
        ]);

        console.log('Key combination sent.');

        // Pause to observe the effect manually if needed
        await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (e) {
        console.error('Test Failed:', e);
    } finally {
        await driver.deleteSession();
        console.log('Session ended');
    }
})();
