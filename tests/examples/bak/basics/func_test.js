const { remote } = require('webdriverio');
const wdioOpts = {
    hostname: '192.168.196.155',
    port: 4723,
    path: '/',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
    },
    logLevel: 'error'
};

async function main() {
    let browser;
    try {
        browser = await remote(wdioOpts);
        // 1. Get Window Rect
        const windowRect = await browser.getWindowRect();
        console.log(windowRect);

        // 2. Get Page Source (Timing Check)
        const source = await browser.getPageSource();
        console.log(source);

        // 3. Get Window Handle
        const handle = await browser.getWindowHandle();
        console.log(handle);

        // 4. Get Window Handles
        const handles = await browser.getWindowHandles();
        console.log(handles);

        // 7. Get Window Size
        const size = await browser.getWindowSize();
        console.log(size);

        // 8. Get Window Rect
        const rect = await browser.getWindowRect();

        // 9. Find Elements
        const elements = await browser.$$("//*");
        console.log(elements.length);

        // 10. Get Element Rect for elements
        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];

            // WDIO standard is getSize/getLocation on element object
            try {
                const size = await element.getSize();
                const location = await element.getLocation();
                console.log(`Element ${i} Rect: `, { ...size, ...location });
            } catch (e) {
                console.log(`Failed to get rect for element ${i}: ${e.message}`);
            }

            const attributes = [
                'AcceleratorKey',
                'AccessKey',
                'AutomationId',
                'ClassName',
                'FrameworkId',
                'HasKeyboardfocus', 
                'HelpText',
                'IsContentelement',
                'IsControlelement',
                'IsEnabled',
                'IsKeyboardfocusable',  
                'IsOffscreen',
                'IsPassword',
                'IsRequiredforform',
                'ItemStatus',
                'ItemType',
                'LocalizedControlType',
                'Name',
                'Orientation',
                'ProcessId',
                'RuntimeId',
                'x',
                'y',
                'width',
                'height',
                'CanMaximize',
                'CanMinimize',
                'IsModal',
                'WindowVisualState',
                'WindowInteractionState',
                'IsTopmost',
                'CanRotate',
                'CanResize',
                'CanMove',
            ];

            for (const attr of attributes) {
                try {
                    const value = await element.getAttribute(attr);
                    console.log(`Element ${i} ${attr}: ${value}`);
                } catch (e) {
                    console.log(`Failed to get ${attr} for element ${i}: ${e.message}`);
                }
            }

            // get attribute all
            try {
                const attributes = await element.getAttribute('all');
                console.log(`Element ${i} Attributes: ${attributes}`);
            } catch (e) {
                console.log(`Failed to get Attributes for element ${i}: ${e.message}`);
            }

        }
    } catch (error) {
        console.error(error);
    } finally {
        if (browser) {
            await browser.deleteSession();
        }
    }
}

main().catch(console.error);