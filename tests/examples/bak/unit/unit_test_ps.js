const { NovaWindows2Driver } = require('../../build/lib/driver');

async function main() {
    const driver = new NovaWindows2Driver();
    driver.caps = { automationName: 'NovaWindows2', platformName: 'Windows' , app: 'Root'};

    try {
        await driver.startPowerShellSession();
        console.log('PowerShell session started.');

        const source = await driver.getPageSource();
        console.log('Page Source Length:', source.length);
    } catch (err) {
        console.error('ERROR during verification:', err);
    } finally {
        await driver.deleteSession();
    }
}

main().catch(console.error);