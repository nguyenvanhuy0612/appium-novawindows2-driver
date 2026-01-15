const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 05_attributes.js (Comprehensive) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245'
        });

        // Use XPath instead of Accessibility ID (~Start)
        // const element = await driver.$('//Button[@Name="Start"]');
        const element = await driver.$('//Window[contains(@Name,"Secure")]');
        console.log('Inspecting "Start" button...');

        const val = await element.getAttribute('all');
        let parsedVal = val;
        try {
            if (typeof val === 'string') {
                parsedVal = JSON.parse(val);
            }
        } catch (e) {
            // keep as string if parse fails
        }
        console.log(`All: \n${JSON.stringify(parsedVal, null, 2)}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
