import time
import traceback
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

driver = webdriver.Remote('http://192.168.196.132:4723', options=options)
print("Connected successfully!")

# Test: Click OK button on main window (with popup present)
print("\n=== TEST: Click //Window[contains(@Name,'SecureAge')]/Button[@Name='OK'] ===")
try:
    el = driver.find_element(AppiumBy.XPATH, "//Window[contains(@Name,'SecureAge')]/Button[@Name='OK']")
    print(f"Found element: {el.id}")
    print(f"Rect: {el.rect}")
    el.click()
    print("TEST: PASSED")
except Exception as e:
    print(f"TEST: FAILED - {e}")
    traceback.print_exc()

driver.quit()
print("\nAll tests completed.")
