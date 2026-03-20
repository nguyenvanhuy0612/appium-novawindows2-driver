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

# Xpath with Index + condition
start = time.time()
print(len(driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[6][contains(@Name,'[sign]')]]")))
print(f"Time1: {time.time() - start} seconds")

# Xpath with condition only
start = time.time()
print(len(driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[contains(@Name,'[sign]')]]")))
print(f"Time2: {time.time() - start} seconds")

# Xpath with index only
start = time.time()
print(len(driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[6]]")))
print(f"Time3: {time.time() - start} seconds")

driver.quit()