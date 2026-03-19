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

print(f"\nConnecting to Appium at http://172.16.10.37:4723 with options...")
driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
print("Connected successfully!")

# --- Test 1: Full page source ---
print("\n=== Test 1: Full page source ===")
page_source = driver.page_source
print(f"Page source length: {len(page_source)}")
print(f"First 300 chars:\n{page_source[:300]}")

# --- Test 2: Element source for a specific window ---
print("\n=== Test 2: Element source for a specific window ===")
windows = driver.find_elements(AppiumBy.XPATH, "//Window")
print(f"Windows found: {len(windows)}")

for win in windows:
    name = win.get_attribute("Name")
    if not name:
        continue

    source = win.get_attribute("source")
    print(f"\nWindow: {name!r}")
    print(f"  source length: {len(source) if source else 0}")
    if source:
        print(f"  first 400 chars:\n{source[:400]}")
    break

# --- Test 3: Element source for a child element ---
print("\n=== Test 3: Element source for a child element ===")
elements = driver.find_elements(AppiumBy.XPATH, "//*")
print(f"Total elements: {len(elements)}")

for el in elements[:10]:
    name = el.get_attribute("Name")
    ctrl = el.get_attribute("ControlType")
    source = el.get_attribute("source")
    print(f"\nElement Name={name!r} ControlType={ctrl!r}")
    print(f"  source length: {len(source) if source else 0}")
    if source:
        print(f"  preview: {source[:200]}")

# --- Test 4: Compare element source vs full page source ---
print("\n=== Test 4: Element source is a subtree of page source ===")
if windows:
    win = next((w for w in windows if w.get_attribute("Name")), None)
    if win:
        win_name = win.get_attribute("Name")
        win_source = win.get_attribute("source")
        in_page = win_source[:100] in page_source if win_source else False
        print(f"Window {win_name!r} source found in full page source: {in_page}")

driver.quit()
print("\nDone.")
