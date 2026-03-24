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

driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
print("Connected!")

# Debug: check what _expectedPid is set to after getProperty("all")
el = driver.find_element(AppiumBy.XPATH, "//Window[@Name='SecureAge Profile - qa']//ListItem")

# Check PID field via powershell execute
pid_check = driver.execute_script("powerShell", {
    "command": "[Win32Helper].GetField('_expectedPid','NonPublic,Static').GetValue($null).ToString()"
})
print(f"_expectedPid before getProperty: {pid_check}")

result = el.get_attribute("all")

pid_check2 = driver.execute_script("powerShell", {
    "command": "[Win32Helper].GetField('_expectedPid','NonPublic,Static').GetValue($null).ToString()"
})
print(f"_expectedPid after getProperty: {pid_check2}")

data = json.loads(result)
print(f"ControlType: {data.get('ControlType')}")
print(f"LegacyIAccessible.Name: {data.get('LegacyIAccessible.Name', 'MISSING')}")
print(f"LegacyIAccessible.Role: {data.get('LegacyIAccessible.Role', 'MISSING')}")

driver.quit()
