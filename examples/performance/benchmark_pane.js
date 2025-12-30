import { remote } from 'webdriverio';

const options = {
    hostname: '172.16.1.52',
    port: 4723,
    logLevel: 'error',
    capabilities: {
        platformName: 'Windows',
        'appium:automationName': 'NovaWindows2',
        'appium:app': 'Root',
        'appium:shouldCloseApp': true,
    },
};

async function benchmark() {
    console.log('Creating session for benchmark...');
    const client = await remote(options);
    console.log('Session created.');

    try {
        console.log('Starting benchmark for powershell...');
        const start = Date.now();
        for (let i = 0; i < 100; i++) {
            const source = await client.getPageSource();
            console.log(source.length);
            const process = await client.execute('powerShell', 'Get-Process');
            console.log(process.length);
        }
        const end = Date.now();
        console.log(`Time taken: ${end - start}ms`);
    } catch (error) {
        console.error('Benchmark failed:', error);
    } finally {
        await client.deleteSession();
        console.log('Session deleted.');
    }
}

benchmark().catch(console.error);
