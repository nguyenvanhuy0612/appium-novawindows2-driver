# This file is used to test the changes made in the lib/ directory
# To deploy the changes, run: ./scripts/mac/build_deploy_restart.sh
# Run this file using: conda run -n py313 python tests/dev_att/test_getproperty.py

import time
from appium import webdriver
from appium.options.windows import WindowsOptions

options = WindowsOptions()
options.load_capabilities({
    "appium:automationName": "NovaWindows2",
    "appium:app": "Root",
    "appium:newCommandTimeout": 60
})
driver = webdriver.Remote("http://172.16.10.37:4723", options=options)
print('Connected to Appium server')

els = driver.find_elements(by="xpath", value="//Window[contains(@Name, 'SecureAge')]//ListItem")
print(len(els))

att_key = [
    "IsKeyboardFocusable",
    "IsRequiredForForm",
    "ClassName",
    "IsControlElement",
    "ProcessId",
    "Name",
    "SelectionItem.SelectionContainer",
    "IsEnabled",
    "ControlType",
    "AutomationId",
    "IsOffscreen",
    "HasKeyboardFocus",
    "ItemStatus",
    "IsContentElement",
    "AcceleratorKey",
    "SelectionItem.IsSelected",
    "ItemType",
    "IsPassword",
    "LocalizedControlType",
    "HelpText",
    "FrameworkId",
    "AccessKey",
    "RuntimeId",
    "Orientation",
    "BoundingRectangle",
    "IsDockPatternAvailable",
    "IsExpandCollapsePatternAvailable",
    "IsGridItemPatternAvailable",
    "IsGridPatternAvailable",
    "IsInvokePatternAvailable",
    "IsMultipleViewPatternAvailable",
    "IsRangeValuePatternAvailable",
    "IsSelectionItemPatternAvailable",
    "IsSelectionPatternAvailable",
    "IsScrollPatternAvailable",
    "IsSynchronizedInputPatternAvailable",
    "IsScrollItemPatternAvailable",
    "IsVirtualizedItemPatternAvailable",
    "IsItemContainerPatternAvailable",
    "IsTablePatternAvailable",
    "IsTableItemPatternAvailable",
    "IsTextPatternAvailable",
    "IsTogglePatternAvailable",
    "IsTransformPatternAvailable",
    "IsValuePatternAvailable",
    "IsWindowPatternAvailable",
    "LegacyIAccessible.DefaultAction",
    "LegacyIAccessible.ChildId",
    "LegacyIAccessible.State",
    "LegacyIAccessible.Role",
    "LegacyIAccessible.Description",
    "LegacyIAccessible.Name",
    "LegacyIAccessible.Value"
]

# Debug MSAA Tree
try:
    print("\n--- MSAA Tree Dump ---")
    print(els[0].get_attribute("DUMP_MSAA"))
except: pass

print(els[0].get_attribute("all"))

for att in att_key:
    print(f"{att}: {els[0].get_attribute(att)}")

driver.quit()