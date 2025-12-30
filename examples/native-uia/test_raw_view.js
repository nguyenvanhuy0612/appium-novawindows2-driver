const { UIAClient, TreeScope } = require('../../build/lib/winapi/uia');

async function testRaw() {
    try {
        const client = new UIAClient();
        const root = client.getRootElement();
        console.log('Root:', root.getName());

        console.log('Getting RawViewCondition...');
        const rawCond = client.getRawViewCondition();
        console.log('Cond obtained:', !!rawCond);

        console.log('Testing findAll with RawViewCondition (Children)...');
        const children = root.findAll(2, rawCond);
        if (children) {
            console.log('Children Count:', children.length);
            if (children.length > 0) {
                const arr = children.toArray();
                for (let i = 0; i < Math.min(5, arr.length); i++) {
                    console.log(`- [${i}] name="${arr[i].getName()}" type=${arr[i].getCurrentPropertyValue(30003)}`);
                }
            }
        }

        console.log('Testing findAll with RawViewCondition (Descendants)...');
        const descendants = root.findAll(4, rawCond);
        if (descendants) {
            console.log('Count:', descendants.length);
            if (descendants.length > 0) {
                console.log('First 5 elements:');
                const arr = descendants.toArray();
                for (let i = 0; i < Math.min(5, arr.length); i++) {
                    console.log(`- [${i}] name="${arr[i].getName()}" type=${arr[i].getCurrentPropertyValue(30003)}`);
                }
            }
        } else {
            console.log('FindAll returned null');
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testRaw();
