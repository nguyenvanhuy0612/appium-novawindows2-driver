const { UIAClient, UIA_ControlTypePropertyId, UIA_PaneControlTypeId } = require('../build/lib/winapi/uia');

async function testCond() {
    try {
        const client = new UIAClient();
        console.log('Creating Property Condition...');
        const cond = client.createPropertyCondition(UIA_ControlTypePropertyId, UIA_PaneControlTypeId);
        console.log('Condition created successfully!', !!cond);
    } catch (e) {
        console.error('Condition creation failed:', e.message);
    }
}

testCond();
