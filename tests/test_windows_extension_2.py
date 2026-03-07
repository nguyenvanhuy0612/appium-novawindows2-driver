import time
import json
from appium import webdriver
from appium.options.common import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestWindowsExtension:
    def setup_method(self, method):
        options = AppiumOptions()
        options.set_capability('platformName', 'Windows')
        options.set_capability('appium:automationName', 'NovaWindows2')
        options.set_capability('appium:app', 'Root')
        options.set_capability('appium:powerShellCommandTimeout', 120000) # 2 mins
        
        print(f"\nConnecting to Appium at http://127.0.0.1:4723 with options...")
        self.driver = webdriver.Remote('http://127.0.0.1:4723', options=options)
        print("Connected successfully!")

    def teardown_method(self, method):
        if hasattr(self, 'driver'):
            self.driver.quit()

    def test_windows_extension(self):
        print("\nTesting Windows Extension commands...")
        
        # 1. Launch Notepad if not already open (though Appium should handle it if 'app' is set)
        # However, for 'Root' session, we might need to find it.
        # Let's assume Notepad is open or we open it.

        explorer = self.driver.find_element(AppiumBy.XPATH, "//*[@Name='Shell Folder View']")

        items = explorer.find_elements(AppiumBy.XPATH, "//List/ListItem/Edit")

        print(len(items))

        for item in items:
            print(item.get_attribute("all"))
        
        print("Testing windows:click with custom parameters (double click with delay)...")
        self.driver.execute_script("windows: click", {
            "button": "left", 
            "durationMs": 100, 
            "times": 2, 
            "interClickDelayMs": 100, 
            "elementId": items[0].id
        })

if __name__ == "__main__":
    test = TestWindowsExtension()
    try:
        test.setup_method(None)
        test.test_windows_extension()
    finally:
        test.teardown_method(None)

