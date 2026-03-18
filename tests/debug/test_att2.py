import time
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

print(f"\nConnecting to Appium at http://172.16.10.37:4723 with options...")
driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
print("Connected successfully!")

elements = driver.find_elements(AppiumBy.XPATH, "//Button[@Name='OK']")

print(len(elements))

for element in elements:
    attrs = element.get_attribute("all")
    try:
        attrs = json.loads(attrs) if isinstance(attrs, str) else attrs
        attrs = json.dumps(attrs, indent=4)
    except Exception:
        pass
    print(f'Element: {element} \n Attributes: \n{attrs}')

    print(element.get_attribute("Name"))
    print(element.get_attribute("FrameworkId"))
    print(element.get_attribute("BoundingRectangle"))
    print(element.get_attribute("LocalizedControlType"))
    print(element.get_attribute("IsContentElement"))
    print(element.get_attribute("ClassName"))
    print(element.get_attribute("AccessKey"))
    print(element.get_attribute("IsRequiredForForm"))
    print(element.get_attribute("ControlType"))
    print(element.get_attribute("AcceleratorKey"))
    print(element.get_attribute("HelpText"))
    print(element.get_attribute("AutomationId"))
    print(element.get_attribute("HasKeyboardFocus"))
    print(element.get_attribute("ItemStatus"))
    print(element.get_attribute("IsControlElement"))
    print(element.get_attribute("IsOffscreen"))
    print(element.get_attribute("RuntimeId"))
    print(element.get_attribute("ProcessId"))
    print(element.get_attribute("ItemType"))
    print(element.get_attribute("IsPassword"))
    print(element.get_attribute("Orientation"))
    print(element.get_attribute("IsEnabled"))
    print(element.get_attribute("IsKeyboardFocusable"))
    print(element.get_attribute("LegacyIAccessible.DefaultAction"))
    print(element.get_attribute("LegacyIAccessible.State"))
    print(element.get_attribute("LegacyIAccessible.Name"))
    print(element.get_attribute("LegacyIAccessible.Role"))
    print(element.get_attribute("LegacyIAccessible.ChildId"))
    print(element.get_attribute("LegacyName"))
    print(element.get_attribute("LegacyState"))
    print(element.get_attribute("LegacyRole"))
    print(element.get_attribute("LegacyChildId"))
    print(element.get_attribute("LegacyDefaultAction"))
    print(element.get_attribute("LegacyHelpText"))
    print(element.get_attribute("LegacyDescription"))
    print(element.get_attribute("LegacyValue"))
    print(element.get_attribute("Value.Value"))
    

driver.quit()
