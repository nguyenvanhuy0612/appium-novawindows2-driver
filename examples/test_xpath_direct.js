const { UIAClient } = require('../build/lib/winapi/uia');
const { NativeXPathEngine } = require('../build/lib/xpath/native');

async function test() {
    try {
        const client = new UIAClient();
        const engine = new NativeXPathEngine(client);

        console.log('--- TEST: /Pane[@Name="Taskbar"] ---');
        const elements = await engine.findElements('/Pane[@Name="Taskbar"]');
        console.log(`Found ${elements.length} elements.`);
        for (const el of elements) {
            console.log(`- ${el.getName()}`);
        }

        console.log('\n--- TEST: //Button[@Name="Start"] ---');
        const buttons = await engine.findElements('//Button[@Name="Start"]');
        console.log(`Found ${buttons.length} buttons.`);
        for (const el of buttons) {
            console.log(`- ${el.getName()}`);
        }

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
