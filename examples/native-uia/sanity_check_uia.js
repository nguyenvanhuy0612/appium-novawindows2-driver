const { UIAClient, TreeScope, UIA_ControlTypePropertyId, UIA_PaneControlTypeId } = require('../../build/lib/winapi/uia');

async function test() {
    try {
        console.log('Initializing UIA Client...');
        const client = new UIAClient();
        console.log('Client initialized.');

        const root = client.getRootElement();
        console.log('Root element acquired.');

        console.log('Creating True Condition...');
        const trueCond = client.createTrueCondition();
        console.log('True Condition created:', !!trueCond);

        console.log('Creating Property Condition (ControlType=Pane)...');
        const paneCond = client.createPropertyCondition(UIA_ControlTypePropertyId, UIA_PaneControlTypeId);
        console.log('Property Condition created:', !!paneCond);

        console.log('Searching for first Pane...');
        const pane = root.findFirst(TreeScope.Children, paneCond);
        if (pane) {
            console.log('Found Pane!');
            console.log('Name:', pane.getName());
        } else {
            console.log('No Pane found.');
        }

        console.log('Test completed successfully!');
    } catch (e) {
        console.error('Test failed with error:', e);
    }
}

test();
