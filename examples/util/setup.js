const { remote } = require('webdriverio');

// const HOST = '192.168.8.245';
const HOST = '192.168.1.19';
const PORT = 4723;
const APP = 'Root'; // 'Root' attaches to the desktop

const defaultCaps = {
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": APP,
    "appium:newCommandTimeout": 3600,
    "appium:connectHardwareKeyboard": true
};

const defaultOptions = {
    hostname: HOST,
    port: PORT,
    path: '/',
    logLevel: 'error',
    capabilities: defaultCaps
};

async function createDriver(overrides = {}) {
    const opts = { ...defaultOptions, ...overrides };
    // Merge capabilities if provided
    if (overrides.capabilities) {
        opts.capabilities = { ...defaultCaps, ...overrides.capabilities };
    }

    console.log(`Connecting to Appium at http://${opts.hostname}:${opts.port}${opts.path}`);
    const driver = await remote(opts);
    return driver;
}

module.exports = {
    createDriver,
    defaultCaps,
    defaultOptions
};
