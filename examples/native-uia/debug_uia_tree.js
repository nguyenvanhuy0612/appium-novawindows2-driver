const { UIAClient, TreeScope, UIA_NamePropertyId, UIA_ControlTypePropertyId, UIA_AutomationIdPropertyId } = require('../../build/lib/winapi/uia');

async function debugRoot() {
    try {
        const client = new UIAClient();
        const root = client.getRootElement();
        console.log('Root Name:', root.getName());

        console.log('--- Children of Desktop ---');
        const trueCond = client.createTrueCondition();
        const children = root.findAll(TreeScope.Children, trueCond);
        if (children) {
            const arr = children.toArray();
            console.log(`Found ${arr.length} children.`);
            for (const el of arr) {
                try {
                    const name = el.getName();
                    const controlType = el.getCurrentPropertyValue(UIA_ControlTypePropertyId);
                    const automationId = el.getCurrentPropertyValue(UIA_AutomationIdPropertyId);
                    console.log(`- [${controlType}] Name: "${name}", AutoId: "${automationId}"`);
                } catch (e) {
                    console.log(`- Error getting properties for an element: ${e.message}`);
                }
            }
        } else {
            console.log('No children found.');
        }
    } catch (e) {
        console.error('Debug failed:', e);
    }
}

debugRoot();
