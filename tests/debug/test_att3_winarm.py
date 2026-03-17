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

driver = webdriver.Remote('http://192.168.10.229:4723', options=options)
print("Connected successfully!")

print(len(driver.find_elements(AppiumBy.XPATH, "//*")))


for element in driver.find_elements(AppiumBy.XPATH, "//Button"):
    print(f'Element {element} All Attributes: {element.get_attribute("all")}')

driver.quit()