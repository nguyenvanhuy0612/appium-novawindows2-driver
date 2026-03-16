import json
from appium import webdriver
from appium.options.windows import WindowsOptions
from appium.webdriver.common.appiumby import AppiumBy

options = WindowsOptions()
options.load_capabilities({
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": "Root",
    "appium:newCommandTimeout": 300
})

driver = webdriver.Remote("http://172.16.10.37:4723", options=options)
print('Connected')

# --- Single element focused test (ComboBox) ---
element = driver.find_element(AppiumBy.XPATH, "//Window[@Name='SecureAge - Address Book']//ComboBox")

print('\n=== Single ComboBox attribute test ===')
print('LegacyIAccessible.Value: ', element.get_attribute("LegacyIAccessible.Value"))
print('LegacyValue:             ', element.get_attribute("LegacyValue"))
print('LegacyIAccessible.Name:  ', element.get_attribute("LegacyIAccessible.Name"))
print('LegacyIAccessible.Role:  ', element.get_attribute("LegacyIAccessible.Role"))
print('LegacyIAccessible.State: ', element.get_attribute("LegacyIAccessible.State"))
print('Value.Value:             ', element.get_attribute("Value.Value"))

# --- All attributes dump and validation ---
print('\n=== All attributes (ComboBox) ===')
all_attrs = json.loads(element.get_attribute("all"))
for key, val in all_attrs.items():
    print(f'  {key}: {val!r}')

# Check key attributes are non-empty
assert all_attrs.get('Value.Value'), f"Value.Value should not be empty, got: {all_attrs.get('Value.Value')!r}"
assert all_attrs.get('LegacyIAccessible.Value'), f"LegacyIAccessible.Value should not be empty"
assert all_attrs.get('Name'), f"Name should not be empty"
assert all_attrs.get('LocalizedControlType') == 'combo box', f"Expected 'combo box', got: {all_attrs.get('LocalizedControlType')!r}"
print('  [PASS] Key attribute assertions passed')

# --- Broad scan: all elements in SecureAge windows ---
print('\n=== Scanning all elements in SecureAge windows ===')
all_elements = driver.find_elements(AppiumBy.XPATH, "//Window[contains(@Name,'SecureAge')]//*")
print(f'Found {len(all_elements)} elements')

issues = []
for i, el in enumerate(all_elements):
    try:
        attrs = json.loads(el.get_attribute("all"))
        tag = attrs.get('LocalizedControlType', '?')
        name = attrs.get('Name', '')
        value_val = attrs.get('Value.Value', '')
        legacy_val = attrs.get('LegacyIAccessible.Value', '')

        # Note: Value.Value (UIA ValuePattern) and LegacyIAccessible.Value (MSAA accValue)
        # can legitimately differ — they come from different sources. Not treated as an error.
        diff_marker = ' *' if value_val and legacy_val and value_val != legacy_val else ''
        print(f'  [{i:03d}] {tag:<20} name={name!r:<30} Value.Value={value_val!r} Legacy={legacy_val!r}{diff_marker}')
    except Exception as e:
        print(f'  [{i:03d}] ERROR: {e}')
        issues.append(i)

if issues:
    print(f'\n[WARN] {len(issues)} element(s) failed to retrieve attributes: {issues}')
else:
    print('\n[PASS] All elements retrieved successfully')


for e in driver.find_elements(AppiumBy.XPATH, "//*"):
    print(e.get_attribute("all"))

driver.quit()
print('\nDone.')
