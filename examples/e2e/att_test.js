const { remote } = require('webdriverio');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const opts = {
        // hostname: '192.168.8.245',
        hostname: '192.168.1.19',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
            "appium:newCommandTimeout": 300
        },
        logLevel: 'error'
    };

    let client;
    try {
        console.log('Connecting to remote server...');
        client = await remote(opts);
        console.log('Session created.');

        // const element = await client.$('//Window')
        // console.log(element)
        // const atts = await element.getAttribute('all')
        // console.log(JSON.stringify(JSON.parse(atts), null, 2));

        // const legacy_value_long = await element.getAttribute('LegacyIAccessible.Value')
        // console.log(`legacy_value_long: ${legacy_value_long}`)

        // const legacy_name_long = await element.getAttribute('LegacyIAccessible.Name')
        // console.log(`legacy_name_long: ${legacy_name_long}`)

        // const legacy_value = await element.getAttribute('LegacyValue')
        // console.log(`legacy_value: ${legacy_value}`)

        // const legacy_name = await element.getAttribute('LegacyName')
        // console.log(`legacy_name: ${legacy_name}`)
        const properties = [
            // --- 1. Element Properties (Standard) ---
            'AcceleratorKey', 'AccessKey', 'AutomationId', 'BoundingRectangle', 'ClassName',
            'ClickablePoint', 'ControlType', 'Culture', 'FrameworkId', 'HasKeyboardFocus',
            'HelpText', 'IsContentElement', 'IsControlElement', 'IsDataValidForForm',
            'IsEnabled', 'IsKeyboardFocusable', 'IsOffscreen', 'IsPassword',
            'IsPeripheral', 'IsRequiredForForm', 'ItemStatus', 'ItemType', 'LabeledBy',
            'LiveSetting', 'LocalizedControlType', 'Name', 'NativeWindowHandle',
            'OptimizeForVisualContent', 'Orientation', 'ProcessId', 'ProviderDescription',
            'RuntimeId', 'SizeOfSet', 'PositionInSet',

            // --- 2. LegacyIAccessible Pattern ---
            'LegacyIAccessible.ChildId', 'LegacyIAccessible.DefaultAction',
            'LegacyIAccessible.Description', 'LegacyIAccessible.Help',
            'LegacyIAccessible.KeyboardShortcut', 'LegacyIAccessible.Name',
            'LegacyIAccessible.Role', 'LegacyIAccessible.Selection',
            'LegacyIAccessible.State', 'LegacyIAccessible.Value',

            // --- 3. Value Pattern ---
            'Value.IsReadOnly', 'Value.Value',

            // --- 4. RangeValue Pattern ---
            'RangeValue.IsReadOnly', 'RangeValue.LargeChange', 'RangeValue.Maximum',
            'RangeValue.Minimum', 'RangeValue.SmallChange', 'RangeValue.Value',

            // --- 5. Selection & SelectionItem Pattern ---
            'Selection.CanSelectMultiple', 'Selection.IsSelectionRequired', 'Selection.Selection',
            'SelectionItem.IsSelected', 'SelectionItem.SelectionContainer',

            // --- 6. Window Pattern ---
            'Window.CanMaximize', 'Window.CanMinimize', 'Window.IsModal',
            'Window.IsTopmost', 'Window.WindowInteractionState', 'Window.WindowVisualState',

            // --- 7. Toggle Pattern ---
            'Toggle.ToggleState',

            // --- 8. ExpandCollapse Pattern ---
            'ExpandCollapse.ExpandCollapseState',

            // --- 9. Grid & GridItem Pattern ---
            'Grid.ColumnCount', 'Grid.RowCount',
            'GridItem.Column', 'GridItem.ColumnSpan', 'GridItem.ContainingGrid',
            'GridItem.Row', 'GridItem.RowSpan',

            // --- 10. Table & TableItem Pattern ---
            'Table.RowOrColumnMajor',
            'TableItem.RowHeaderItems', 'TableItem.ColumnHeaderItems',

            // --- 11. Scroll Pattern ---
            'Scroll.HorizontallyScrollable', 'Scroll.HorizontalScrollPercent',
            'Scroll.HorizontalViewSize', 'Scroll.VerticallyScrollable',
            'Scroll.VerticalScrollPercent', 'Scroll.VerticalViewSize',

            // --- 12. Transform Pattern ---
            'Transform.CanMove', 'Transform.CanResize', 'Transform.CanRotate',

            // --- 13. Dock Pattern ---
            'Dock.DockPosition',

            // --- 14. MultipleView Pattern ---
            'MultipleView.CurrentView', 'MultipleView.SupportedViews',

            // --- 15. Aliases (Validating types.ts resolution) ---
            'LegacyName',              // -> LegacyIAccessible.Name
            'LegacyValue',             // -> LegacyIAccessible.Value
            'LegacyDescription',       // -> LegacyIAccessible.Description
            'LegacyRole',              // -> LegacyIAccessible.Role
            'LegacyState',             // -> LegacyIAccessible.State
            'LegacyHelp',              // -> LegacyIAccessible.Help
            'LegacyDefaultAction',     // -> LegacyIAccessible.DefaultAction
            'LegacyChildId',           // -> LegacyIAccessible.ChildId
            'LegacyKeyboardShortcut',  // -> LegacyIAccessible.KeyboardShortcut

            'CanMaximize',             // -> Window.CanMaximize
            'CanMinimize',             // -> Window.CanMinimize
            'IsModal',                 // -> Window.IsModal
            'IsTopmost',               // -> Window.IsTopmost

            'CanMove',                 // -> Transform.CanMove
            'CanResize',               // -> Transform.CanResize
            'CanRotate',               // -> Transform.CanRotate

            'ToggleState',             // -> Toggle.ToggleState
            'ExpandCollapseState',     // -> ExpandCollapse.ExpandCollapseState
            'IsReadOnly',              // -> Value.IsReadOnly

            // --- 16. MSAA (Explicit Fallback) ---
            //'msaa.accName', 'msaa.accRole', 'msaa.accState', 'msaa.accValue'
        ]

        // const elements = await client.$$('//Pane/Button[@Name="Start"]')
        const elements = await client.$$("//Window[contains(@Name,'Secure')]//ComboBox")
        console.log(`Number of elements: ${elements.length}`);
        for (let i = 0; i < elements.length; i++) {
            for (const property of properties) {
                if (property.startsWith("LegacyIAccessible.") || property.startsWith("Value.")) {
                    const value = await elements[i].getAttribute(property)
                    console.log(`Element ${i}: ${property}: ${value}`)
                }
            }
            break;
        }

    } catch (e) {
        console.error('Failed to launch Explorer:', e);
    } finally {
        if (client) {
            await client.deleteSession();
        }
    }
}

main();