const { createDriver } = require('../util/setup');

async function main() {
    let driver;
    try {
        driver = await createDriver({hostname: '192.168.8.245'});
        const element = await driver.$('xpath://Text[starts-with(@Name, "Signing:")]');
        const name = await element.getAttribute('Name');
        console.log(`Name: ${name}`);
    } finally {
        if (driver) {
            await driver.deleteSession();
        }
    }

}

main().catch(console.error);


