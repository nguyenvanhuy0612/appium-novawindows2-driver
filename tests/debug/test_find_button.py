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

driver = webdriver.Remote('http://192.168.196.132:4723', options=options)
print("Connected successfully!")

# Get page source to find button structure
print("\n=== Getting page source (snippet around Button/clipboardGroup) ===")
try:
    source = driver.page_source
    # Find relevant section around clipboardGroup
    idx = source.find('clipboardGroup')
    if idx != -1:
        print(source[max(0, idx-300):idx+300])
    else:
        print("'clipboardGroup' NOT found in page source")
        # Try finding any Button elements
        btn_idx = source.find('<Button')
        if btn_idx != -1:
            print(f"Sample Button elements found:")
            print(source[btn_idx:btn_idx+500])
except Exception as e:
    print(f"Page source error: {e}")

# Try find element with wildcard attribute
print("\n=== Finding //Button[@*='cmd.clipboardGroup@'] ===")
try:
    els = driver.find_elements(AppiumBy.XPATH, "//Button[@*='cmd.clipboardGroup@']")
    print(f"Found {len(els)} element(s)")
    for el in els:
        print(f"  Element id: {el.id}")
        try:
            print(f"  Name: {el.get_attribute('Name')}")
            print(f"  AutomationId: {el.get_attribute('AutomationId')}")
        except Exception as e:
            print(f"  Attribute error: {e}")
except Exception as e:
    print(f"FAILED: {e}")

driver.quit()
print("\nDone.")
