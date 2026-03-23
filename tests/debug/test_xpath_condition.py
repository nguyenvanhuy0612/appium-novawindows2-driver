import unittest
import time
from appium import webdriver
from appium.options.windows import WindowsOptions
from appium.webdriver.common.appiumby import AppiumBy

class TestXPathCondition(unittest.TestCase):
    def run_xpath_check(self, app_name):
        options = WindowsOptions()
        options.load_capabilities({
            "platformName": "Windows",
            "appium:automationName": "NovaWindows2",
            "appium:app": app_name,
            "appium:newCommandTimeout": 300
        })

        driver = None
        try:
            print(f"\nConnecting with app: {app_name}")
            driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
            print("Connected successfully!")

            if app_name == "root":
                app = driver.find_element(AppiumBy.XPATH, "//Window[contains(@Name, 'SecureAge')]")
            else:
                app = driver

            xpath = "//ListItem[./Text[6][contains(@Name, '[encrypt]') or contains(@Name, '[SecureData encrypt]')]]/Text"
            
            start = time.time()
            els = app.find_elements(AppiumBy.XPATH, xpath)
            elapsed = time.time() - start
            
            print(f"Found {len(els)} elements in {elapsed:.2f}s")
            self.assertGreater(len(els), 0, f"Should have found at least one element for app: {app_name}")
            
            for i, el in enumerate(els):
                name = el.get_attribute("Name")
                print(f"  [{i+1}] Name={name!r}")
                
            if len(els) >= 6:
                name_6 = els[5].get_attribute("Name")
                self.assertIn("[encrypt]", name_6)
        finally:
            if driver:
                driver.quit()
                print(f"Driver for {app_name} quit.")

    def test_xpath_comparison(self):
        apps = [
            "C:\\Program Files\\SecureAge\\bin\\SecureAge.exe",
            "root"
        ]
        
        for app in apps:
            with self.subTest(app=app):
                self.run_xpath_check(app)

if __name__ == "__main__":
    unittest.main()