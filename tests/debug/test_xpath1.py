import unittest
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

driver = None
try:
    driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
    print("Connected successfully!")
    xpath = "//ListItem[./Text[6][contains(@Name, '[encrypt]') or contains(@Name, '[SecureData encrypt]')]]/Text"
    start = time.time()
    els = driver.find_elements(AppiumBy.XPATH, xpath)
    elapsed = time.time() - start
    print(f"Found {len(els)} elements in {elapsed:.2f}s")
    for i, el in enumerate(els):
        name = el.get_attribute("Name")
        print(f"  [{i+1}] Name={name!r}")

finally:
    if driver:
        driver.quit()