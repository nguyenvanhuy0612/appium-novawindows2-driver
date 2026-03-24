import unittest
import time
from appium import webdriver
from appium.options.windows import WindowsOptions
from appium.webdriver.common.appiumby import AppiumBy

options = WindowsOptions()
options.load_capabilities({
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": "C:\\Windows\\System32\\notepad.exe",
    "appium:newCommandTimeout": 300
})
url = "http://172.16.1.52:4723"

driver = webdriver.Remote(url, options=options)
with open("source_app.xml", "w") as f:
    print(len(driver.page_source))
    f.write(driver.page_source)
driver.quit()


options = WindowsOptions()
options.load_capabilities({
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": "Root",
    "appium:newCommandTimeout": 300
})

driver = webdriver.Remote(url, options=options)
with open("source_root.xml", "w") as f:
    print(len(driver.page_source))
    f.write(driver.page_source)
driver.quit()
