const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        const elements = await driver.$$("//Window[starts-with(@Name, 'Sec')]//ComboBox[contains(@Name,'Recip') and @ClassName='ComboBox']");
        const attributes = [
            'Name', 'ControlType', 'LocalizedControlType', 'BoundingRectangle', 'IsEnabled', 'IsOffscreen',
            'IsKeyboardFocusable', 'HasKeyboardFocus', 'AccessKey', 'ProcessId', 'RuntimeId', 'AutomationId',
            'FrameworkId', 'ClassName', 'NativeWindowHandle', 'IsContentElement', 'ProviderDescription',
            'IsPassword', 'HelpText', 'IsDialog', 'ExpandCollapse.ExpandCollapseState',
            'LegacyChildId', 'LegacyDefaultAction', 'LegacyDescription', 'LegacyHelp', 'LegacyKeyboardShortcut',
            'LegacyName', 'LegacyRole', 'LegacyState', 'LegacyValue',
            'Value.IsReadOnly', 'Value.Value',
            'IsAnnotationPatternAvailable', 'IsDragPatternAvailable', 'IsDockPatternAvailable',
            'IsDropTargetPatternAvailable', 'IsExpandCollapsePatternAvailable', 'IsGridItemPatternAvailable',
            'IsGridPatternAvailable', 'IsInvokePatternAvailable', 'IsItemContainerPatternAvailable',
            'IsLegacyIAccessiblePatternAvailable', 'IsMultipleViewPatternAvailable', 'IsObjectModelPatternAvailable',
            'IsRangeValuePatternAvailable', 'IsScrollItemPatternAvailable', 'IsScrollPatternAvailable',
            'IsSelectionItemPatternAvailable', 'IsSelectionPatternAvailable', 'IsSpreadsheetItemPatternAvailable',
            'IsSpreadsheetPatternAvailable', 'IsStylesPatternAvailable', 'IsSynchronizedInputPatternAvailable',
            'IsTableItemPatternAvailable', 'IsTablePatternAvailable', 'IsTextChildPatternAvailable',
            'IsTextEditPatternAvailable', 'IsTextPatternAvailable', 'IsTextPattern2Available',
            'IsTogglePatternAvailable', 'IsTransformPatternAvailable', 'IsTransform2PatternAvailable',
            'IsValuePatternAvailable', 'IsVirtualizedItemPatternAvailable', 'IsWindowPatternAvailable',
            'IsCustomNavigationPatternAvailable', 'IsSelectionPattern2Available'
        ];

        for (const element of elements) {
            console.log("--- Element ---");
            for (const attr of attributes) {
                const value = await element.getAttribute(attr);
                console.log(`${attr}: ${value}`);
            }
        }
    } catch (error) {
        console.error(error);
    } finally {
        await driver.deleteSession();
    }
}

main();