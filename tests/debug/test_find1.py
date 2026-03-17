import time
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

start = time.time()
for el in driver.find_elements(AppiumBy.XPATH, "//Button"):
    print(el.get_attribute("all"))
print(f"Time1: {time.time() - start} seconds")

start = time.time()
for el in driver.find_elements(AppiumBy.XPATH, "//Button[contains(@Name,'')]"):
    print(el.get_attribute("all"))
print(f"Time2: {time.time() - start} seconds")