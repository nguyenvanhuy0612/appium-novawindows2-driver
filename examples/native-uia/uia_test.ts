
import { UIAClient, TreeScope } from '../../lib/winapi/uia';

async function main() {
    try {
        console.log('Initializing UIAClient...');
        const client = new UIAClient();
        console.log('Client created successfully.');

        console.log('Getting Root Element...');
        const root = client.getRootElement();
        console.log('Root element retrieved.');

        console.log('Creating True Condition...');
        const trueCondition = client.createTrueCondition();
        console.log('True Condition created.');

        console.log('Finding all children...');
        const children = root.findAll(TreeScope.Children, trueCondition);

        if (children) {
            console.log(`Found ${children.length} children.`);
            const count = children.length;
            for (let i = 0; i < count; i++) {
                const el = children.getElement(i);
                try {
                    const controlType = el.getCurrentPropertyValue(30003); // UIA_ControlTypePropertyId
                    const name = el.getCurrentPropertyValue(30005); // UIA_NamePropertyId
                    console.log(`[${i}] Name: "${name}", ControlType: ${controlType}`);
                } catch (e) { }
            }
        } else {
            console.log('No children found (returned null).');
        }

        console.log('Testing JS-side FindFirstByProperty (String Name)...');
        // Find "Taskbar" by name (Common element)
        const taskbar = root.findFirstByProperty(TreeScope.Children, 30005, "Taskbar", client);

        if (taskbar) {
            console.log('Found "Taskbar" by name (JS Fallback)!');
            const tbName = taskbar.getCurrentPropertyValue(30005);
            console.log(`Verified Name: "${tbName}"`);
        } else {
            console.log('Failed to find "Taskbar" by name (JS Fallback). Maybe not present?');
            // Try matching first child name if available
            if (children && children.length > 0) {
                const firstEl = children.getElement(0);
                const firstName = firstEl.getCurrentPropertyValue(30005);
                console.log(`Trying to find first child by name: "${firstName}"`);
                if (firstName) {
                    const found = root.findFirstByProperty(TreeScope.Children, 30005, firstName, client);
                    if (found) console.log("Found first child by name!");
                    else console.log("Failed to find first child by name.");
                }
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
