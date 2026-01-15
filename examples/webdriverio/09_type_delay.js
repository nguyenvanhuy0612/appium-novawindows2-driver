const { createDriver, sleep } = require('../util/setup');

async function main() {
    console.log('--- 08_type_delay.js (Input Typing & Delays) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245'
        });

        // 1. Find an Edit element (Adjust selector as needed for your app)
        // Common assumption: Notepad or similar plain text area
        const editBox = await driver.$('//Document[@Name="Text Editor"]');

        console.log('Found edit box. Clearing...');
        await editBox.clearValue();

        // 2. Default Typing (Fast)
        console.log('Test 1: Default Typing (Fast)...');
        await editBox.addValue('This is very fast typing\n');
        await sleep(1000);

        // 3. Enable Global Delay (Required for overrides to work)
        console.log('Enabling global typeDelay (10ms)...');
        await driver.execute('windows: typeDelay', 10);

        // 4. Override with [delay:XXX] - String
        console.log('Test 2: Override [delay:200] (String)...');
        // This should type 'Slow' with 200ms delay per char
        await editBox.addValue('[delay:200]This is very slow typing\n');
        await sleep(1000);

        // 5. Override with [delay:XXX] - Array
        console.log('Test 3: Override [delay:500] (Array)...');
        // This should type 'One', then 'Two' with 500ms delay per char for correct array handling
        // await editBox.addValue(['[delay:500]Typing with delay of 500ms', 'Two\n']);
        // await sleep(1000);

        // 6. Disable Global Delay
        console.log('Disabling global typeDelay (set to 0)...');
        await driver.execute('windows: typeDelay', 0);

        // 7. Verify Override is Ignored when Global is 0
        console.log('Test 4: Override Ignored (Should be Fast)...');
        await editBox.addValue('[delay:500]This is very fast typing\n');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main().catch(console.error);
}
