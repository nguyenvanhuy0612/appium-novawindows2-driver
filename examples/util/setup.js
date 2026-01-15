const { remote } = require('webdriverio');

// const HOST = '192.168.8.245';
const HOST = '192.168.1.19';
const PORT = 4723;
const APP = 'Root'; // 'Root' attaches to the desktop

const defaultCaps = {
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": APP,
    "appium:newCommandTimeout": 3600,
    "appium:connectHardwareKeyboard": true
};

const defaultOptions = {
    hostname: HOST,
    port: PORT,
    path: '/',
    logLevel: 'error',
    capabilities: defaultCaps
};

async function createDriver(overrides = {}) {
    const opts = { ...defaultOptions, ...overrides };
    // Merge capabilities if provided
    if (overrides.capabilities) {
        opts.capabilities = { ...defaultCaps, ...overrides.capabilities };
    }

    console.log(`Connecting to Appium at http://${opts.hostname}:${opts.port}${opts.path}`);
    const driver = await remote(opts);
    return driver;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

module.exports = {
    createDriver,
    defaultCaps,
    defaultOptions,
    properties,
    sleep
};
