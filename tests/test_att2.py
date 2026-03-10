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

elements = driver.find_elements(AppiumBy.XPATH, "//List[@Name='Items View']")

print(len(elements))

for element in elements:
    print(element.get_attribute('all'))

driver.quit()
