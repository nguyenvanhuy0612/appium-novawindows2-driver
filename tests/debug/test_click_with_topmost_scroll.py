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

driver = webdriver.Remote('http://192.168.196.132:4723', options=options)
print("Connected successfully!")

elements = driver.find_elements(AppiumBy.XPATH, "//ListItem/Text[@Name='00013']")

print(len(elements))

elements[0].click()

driver.quit()
