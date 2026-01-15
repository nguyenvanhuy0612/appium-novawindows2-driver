const { createDriver } = require('../util/setup');

async function testAbsolute(driver) {
    const window = await driver.$('//Window[starts-with(@Name,"Secure")]');
    console.log('Found window:', window);

    const tabConverted = await window.$('//Tab');
    console.log('Found tabConverted:', tabConverted);

    const tab = await window.$('.//Tab');
    console.log('Found tab:', tab);

    const rootList = await driver.$$('//ListItem');
    console.log('Found rootList:', rootList.length);

    const list1 = await window.$$('//ListItem');
    console.log('Found list1:', list1.length);

    const list2 = await window.$$('.//ListItem');
    console.log('Found list2:', list2.length);
}

async function main() {
    console.log('--- 03_finding_elements.js (Enhanced) ---');
    let driver;
    try {

        // ---------------------------------------------------------
        // Scenario A: Default Behavior (convertAbsoluteXPath = true)
        // ---------------------------------------------------------
        console.log('\n[Scenario A] Default: convertAbsoluteXPathToRelativeFromElement = true');
        driver = await createDriver(); // Default caps

        const window = await driver.$('//Window[starts-with(@Name,"Secure")]');
        console.log('Found window:', window);

        const tabConverted = await window.$('//Tab');
        console.log('Found tabConverted:', tabConverted);

        const tab = await window.$('.//Tab');
        console.log('Found tab:', tab);

        const rootList = await driver.$$('//ListItem');
        console.log('Found rootList:', rootList.length);

        const list1 = await window.$$('//ListItem');
        console.log('Found list1:', list1.length);

        const list2 = await window.$$('.//ListItem');
        console.log('Found list2:', list2.length);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }
}

if (require.main === module) {
    main();
}
