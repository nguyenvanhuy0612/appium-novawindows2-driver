const { UIAClient, TreeScope } = require('../../build/lib/winapi/uia');

async function testFindAll() {
    try {
        const client = new UIAClient();
        const root = client.getRootElement();
        console.log('Root:', root.getName());

        const trueCond = client.createTrueCondition();
        console.log('Cond:', !!trueCond);

        console.log('Testing scope=2 (Children)...');
        const children = root.findAll(2, trueCond);
        console.log('Children search returned:', children ? 'not null' : 'null');
        if (children) {
            console.log('Count:', children.length);
        }

        console.log('Testing scope=4 (Descendants)...');
        const descendants = root.findAll(4, trueCond);
        console.log('Descendants search returned:', descendants ? 'not null' : 'null');
        if (descendants) {
            console.log('Count:', descendants.length);
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testFindAll();
