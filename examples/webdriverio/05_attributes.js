const { createDriver } = require('../util/setup');

async function main() {
    console.log('--- 05_attributes.js (Comprehensive) ---');
    let driver;
    try {
        driver = await createDriver();

        // Use XPath instead of Accessibility ID (~Start)
        const element = await driver.$('//*[@Name="Start"]');
        console.log('Inspecting "Start" button...');

        // Full list of properties from legacy `att_test.js`
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

            // --- 15. Aliases ---
            'LegacyName', 'LegacyRole', 'LegacyState', 'LegacyValue',
            'IsInvokePatternAvailable'
        ];

        for (const prop of properties) {
            try {
                const val = await element.getAttribute(prop);
                if (val !== null && val !== '') {
                    console.log(`  ${prop}: ${val}`);
                }
            } catch (e) {
                // Suppress errors for missing patterns
            }
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (driver) await driver.deleteSession();
    }
}

if (require.main === module) {
    main();
}
