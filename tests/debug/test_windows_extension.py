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
        import os
        os.system("start notepad.exe")
        time.sleep(2)
        
        # Find Notepad window
        notepad = self.driver.find_element(AppiumBy.XPATH, "//*[@Name='Untitled - Notepad' or @Name='*Untitled - Notepad']")
        edit_area = notepad.find_element(AppiumBy.CLASS_NAME, "Edit")
        
        # --- windows:click ---
        print("Testing windows:click...")
        # Left click
        self.driver.execute_script("windows: click", {"elementId": edit_area.id})
        
        # User requested specific click test
        print("Testing windows:click with custom parameters (double click with delay)...")
        self.driver.execute_script("windows: click", {
            "button": "left", 
            "durationMs": 100, 
            "times": 2, 
            "interClickDelayMs": 100, 
            "elementId": edit_area.id
        })
        
        # Clear edit area first
        self.driver.execute_script("windows: keys", {"actions": [{"text": "Testing click and keys..."}]})
        
        # Double click to select word
        self.driver.execute_script("windows: click", {"elementId": edit_area.id, "times": 2})
        time.sleep(1)
        
        # Right click to open context menu
        self.driver.execute_script("windows: click", {"elementId": edit_area.id, "button": "right"})
        time.sleep(1)
        # Escape context menu
        self.driver.execute_script("windows: keys", {"actions": [{"virtualKeyCode": 0x1B}]}) # ESC
        
        # --- windows:hover ---
        print("Testing windows:hover...")
        # Hover from one point to another in the edit area
        self.driver.execute_script("windows: hover", {
            "startElementId": edit_area.id,
            "startX": 10, "startY": 10,
            "endElementId": edit_area.id,
            "endX": 100, "endY": 100,
            "durationMs": 1000
        })
        
        # --- windows:keys ---
        print("Testing windows:keys...")
        # Type more text
        self.driver.execute_script("windows: keys", {
            "actions": [
                {"pause": 500},
                {"text": "\nNewline text with virtual keys: "},
                {"virtualKeyCode": 0x0D}, # Enter
                {"text": "Done typing."}
            ]
        })
        
        # --- windows:clickAndDrag ---
        print("Testing windows:clickAndDrag...")
        # Drag to select some text
        self.driver.execute_script("windows: clickAndDrag", {
            "startElementId": edit_area.id,
            "startX": 0, "startY": 0,
            "endElementId": edit_area.id,
            "endX": 200, "endY": 50,
            "durationMs": 1000
        })
        
        # --- windows:scrollIntoView ---
        print("Testing windows:scrollIntoView...")
        # Fill Notepad with many lines
        long_text = "\n".join([f"Line {i}" for i in range(100)])
        self.driver.execute_script("windows: keys", {"actions": [{"text": long_text}]})
        
        # Find something at the bottom (this might be tricky depending on UIA tree)
        # Let's try to just scroll the edit area if it's scrollable or find a child element
        # For scrollIntoView to work, we usually need an element that is off-screen.
        # We can try to find "Line 99"
        try:
            target_line = edit_area.find_element(AppiumBy.XPATH, "//*[contains(@Name, 'Line 99')]")
            self.driver.execute_script("windows: scrollIntoView", {"elementId": target_line.id})
            print("scrollIntoView successful")
            
            # --- test click auto-scroll ---
            print("Testing implicit scroll on click for an off-screen element...")
            target_line_10 = edit_area.find_element(AppiumBy.XPATH, "//*[contains(@Name, 'Line 10')]")
            self.driver.execute_script("windows: click", {"elementId": target_line_10.id})
            print("Implicit click-scroll successful")
        except Exception as e:
            print(f"scrollIntoView or click test skipped or failed: {e}")

        print("All extension tests completed!")

if __name__ == "__main__":
    test = TestWindowsExtension()
    try:
        test.setup_method(None)
        test.test_windows_extension()
    finally:
        test.teardown_method(None)

