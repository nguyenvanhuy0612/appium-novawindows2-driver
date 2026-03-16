const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 06_2_scroll_into_view.js (ScrollIntoView) ---');
    let driver;
    try {
        driver = await createDriver();

        await driver.$('//Button[contains(@Name, "Change")]').click();

        console.log('Scrolling (if element found)');
        try {
            const list = await driver.$('//List');
            const item = await list.$('//ListItem[last()]');
            await driver.execute('windows: scrollIntoView', item);
            console.log('Scrolled to last item.');
        } catch (ignore) {
            console.log('Skipped scroll test (no list found).');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main().catch(console.error);
}
