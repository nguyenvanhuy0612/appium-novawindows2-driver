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

# Test 1: Click visible element - should NOT scroll
print("\n=== TEST 1: Click visible element (no scroll expected) ===")
try:
    el = driver.find_element(AppiumBy.XPATH, "//Window[contains(@Name,'SecureAge')]//ListItem[1]/Text")
    print(f"Element: {el.id}")
    rect_before = el.rect
    print(f"Rect BEFORE: {rect_before}")
    el.click()
    rect_after = el.rect
    print(f"Rect AFTER:  {rect_after}")
    scrolled = rect_before['y'] != rect_after['y'] or rect_before['x'] != rect_after['x']
    print(f"Scrolled: {scrolled} (expected: False)")
    print("TEST 1: PASSED" if not scrolled else "TEST 1: WARNING - unexpected scroll")
except Exception as e:
    print(f"TEST 1: FAILED - {e}")
    traceback.print_exc()

time.sleep(1)

# Test 2: Click off-screen element - SHOULD scroll down
print("\n=== TEST 2: Scroll (via click) DOWN to ListItem[@Name='00013'] ===")
try:
    el = driver.find_element(AppiumBy.XPATH, "//Window[contains(@Name,'SecureAge')]//ListItem[@Name='00013']")
    print(f"Element: {el.id}")
    rect_before = el.rect
    print(f"Rect BEFORE: {rect_before}")
    el.click()
    rect_after = el.rect
    print(f"Rect AFTER:  {rect_after}")
    scrolled = rect_before['y'] != rect_after['y']
    print(f"Scrolled: {scrolled} (expected: True)")
    print("TEST 2: PASSED" if scrolled else "TEST 2: FAILED - no scroll happened")
except Exception as e:
    print(f"TEST 2: FAILED - {e}")
    traceback.print_exc()

time.sleep(1)

# Test 3: Click off-screen Text element - SHOULD scroll back up
print("\n=== TEST 3: Scroll (via click) UP to ListItem[1]/Text ===")
try:
    el = driver.find_element(AppiumBy.XPATH, "//Window[contains(@Name,'SecureAge')]//ListItem[1]/Text")
    print(f"Element: {el.id}")
    rect_before = el.rect
    print(f"Rect BEFORE: {rect_before}")
    el.click()
    rect_after = el.rect
    print(f"Rect AFTER:  {rect_after}")
    scrolled = rect_before['y'] != rect_after['y']
    print(f"Scrolled: {scrolled} (expected: True)")
    print("TEST 3: PASSED" if scrolled else "TEST 3: FAILED - no scroll happened")
except Exception as e:
    print(f"TEST 3: FAILED - {e}")
    traceback.print_exc()

driver.quit()
print("\nAll tests completed.")
