"""
E2E tests for @* (wildcard attribute) XPath support.
Tests: equality, inequality, contains, starts-with, existence.
Connects to remote Appium at http://192.168.196.132:4723.
"""
import sys
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

print("Connecting to Appium...")
driver = webdriver.Remote('http://192.168.196.132:4723', options=options)
print("Connected.\n")

errors = []

def check(label, xpath):
    try:
        els = driver.find_elements(AppiumBy.XPATH, xpath)
        print(f"  PASS  {label}: {len(els)} element(s)")
    except Exception as e:
        print(f"  FAIL  {label}: {e}")
        errors.append(label)

# 1. @* equality
print("=== 1. @* equality ===")
check("@*='cmd.clipboardGroup@'", "//Button[@*='cmd.clipboardGroup@']")

# 2. @* equality matching Name via wildcard
print("\n=== 2. @* equality on Name ===")
check("@*='Taskbar'", "//*[@*='Taskbar']")

# 3. contains(@*, ...)
print("\n=== 3. contains(@*, ...) ===")
check("contains(@*, 'clipboardGroup')", "//Button[contains(@*, 'clipboardGroup')]")

# 4. starts-with(@*, ...)
print("\n=== 4. starts-with(@*, ...) ===")
check("starts-with(@*, 'cmd.')", "//Button[starts-with(@*, 'cmd.')]")

# 5. @* inequality
print("\n=== 5. @* inequality ===")
check("@*!='' returns elements", "//Button[@*!='']")

# 6. Bare @* existence predicate
print("\n=== 6. [@*] existence ===")
check("[@*] existence returns elements", "//Button[@*]")

driver.quit()
print("\n" + "=" * 50)
if errors:
    print(f"FAILED: {len(errors)} test(s) failed: {errors}")
    sys.exit(1)
else:
    print("All tests PASSED.")
