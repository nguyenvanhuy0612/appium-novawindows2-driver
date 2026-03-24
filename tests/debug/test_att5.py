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
print("Connected successfully!")

element = driver.find_element(AppiumBy.XPATH, "//Window[@Name='SecureAge Profile - qa']//ListItem")
print(element.get_attribute("all"))

driver.quit()