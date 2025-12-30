const { UIAClient } = require('../build/lib/winapi/uia');

async function probe() {
    try {
        console.log('Init client...');
        const client = new UIAClient();
        console.log('Get root...');
        const root = client.getRootElement();
        console.log('Call getName()...');
        const name = root.getName();
        console.log('Root Name:', name);
    } catch (e) {
        console.error('Probe failed:', e);
    }
}

probe();
