"""
Verify XPath fix on deployed 1.1.5:
1. Get page source to inspect element tree
2. Test: //ListItem[./Text[6][contains(@Name, '[encrypt]') or contains(@Name, '[SecureData encrypt]')]]/Text
"""
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
print("Connected successfully!\n")

# 1. Get page source and save
print("=== Getting page source ===")
start = time.time()
source = driver.page_source
print(f"Page source length: {len(source)} chars, took {time.time()-start:.2f}s")
with open("page_source.xml", "w", encoding="utf-8") as f:
    f.write(source)
print("Saved to page_source.xml\n")

# 2. Test the XPath
xpath = "//ListItem[./Text[6][contains(@Name, '[encrypt]') or contains(@Name, '[SecureData encrypt]')]]/Text"
print(f"=== Testing XPath ===")
print(f"XPath: {xpath}\n")

start = time.time()
els = driver.find_elements(AppiumBy.XPATH, xpath)
elapsed = time.time() - start
print(f"Found {len(els)} elements in {elapsed:.2f}s")

for i, el in enumerate(els):
    name = el.get_attribute("Name")
    print(f"  [{i+1}] Name={name!r}")

# 3. Also test the original bug case
print("\n=== Original bug test (should be 1) ===")
start = time.time()
els2 = driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[6][contains(@Name,'[sign]')]]")
print(f"//ListItem[./Text[6][contains(@Name,'[sign]')]]] → {len(els2)} results ({time.time()-start:.2f}s)")

# 4. Baseline checks
print("\n=== Baselines ===")
start = time.time()
els3 = driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[contains(@Name,'[sign]')]]")
print(f"//ListItem[./Text[contains(@Name,'[sign]')]]] → {len(els3)} results ({time.time()-start:.2f}s)")

start = time.time()
els4 = driver.find_elements(AppiumBy.XPATH, "//ListItem[./Text[6]]")
print(f"//ListItem[./Text[6]] → {len(els4)} results ({time.time()-start:.2f}s)")

driver.quit()
print("\nDone.")
