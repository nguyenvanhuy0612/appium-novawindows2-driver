import { remote } from 'webdriverio';

const caps = {
    hostname: '192.168.1.19',
    port: 4723,
    path: '/',
    capabilities: {
        'appium:platformName': 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': "Root",
    }
};

(async () => {
    const driver = await remote(caps);
    try {
        const source = await driver.getPageSource();
        console.log(`Source length: ${source.length}`);

        const edgeBtnTaskBar = await driver.$("//Pane//Button[@Name='Microsoft Edge']");
        console.log(`Edge btn task bar: ${edgeBtnTaskBar}`);

        await edgeBtnTaskBar.click();

        const source2 = await driver.getPageSource();
        console.log(`Source length: ${source2.length}`);

    } finally {
        await driver.deleteSession();
    }
})().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
