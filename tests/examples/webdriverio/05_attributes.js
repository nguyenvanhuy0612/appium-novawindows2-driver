const { createDriver, properties } = require('../util/setup');

async function main() {
    console.log('--- 05_attributes.js (Comprehensive) ---');
    let driver;
    try {
        driver = await createDriver({
            hostname: '192.168.8.245'
        });

        // Use XPath instead of Accessibility ID (~Start)
        // const element = await driver.$('//Button[@Name="Start"]');
        const element = await driver.$('//Window[contains(@Name,"Secure")]//ComboBox');
        console.log('Inspecting "ComboBox" button...');

        for (const prop of properties) {
            try {
                const val = await element.getAttribute(prop);
                console.log(`${prop}: ${val}`);
            } catch (e) {
                console.error(`Error getting ${prop}:`, e);
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
