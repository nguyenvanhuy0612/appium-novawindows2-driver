import time
import json
from appium import webdriver
from appium.options.common import AppiumOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestPerformanceAndXPath:
    def setup_method(self, method):
        options = AppiumOptions()
        options.set_capability('platformName', 'Windows')
        options.set_capability('appium:automationName', 'NovaWindows2')
        options.set_capability('appium:app', 'Root')
        options.set_capability('appium:powerShellCommandTimeout', 120000) # 2 mins
        
        print(f"\nConnecting to Appium at http://127.0.0.1:4723/novawindows2 with options...")
        self.driver = webdriver.Remote('http://127.0.0.1:4723/novawindows2', options=options)
        print("Connected successfully!")

    def teardown_method(self, method):
        if hasattr(self, 'driver'):
            self.driver.quit()

    def test_expanded_xpath_performance(self):
        print("\n=== STARTING EXPANDED XPATH & PERFORMANCE TESTS ===")
        
        xpaths = [
            "/*/*", # Top-level
            "//*[starts-with(@ClassName, 'Chrome')]",
            "//*[contains(@Name, 'Antigravity')]",
            "//Window[@ClassName='Chrome_WidgetWin_1']",
            "//Window[@ClassName='Chrome_WidgetWin_1']//Pane",
            "//*[@IsEnabled='True' and @IsOffscreen='False']",
            "//*[@ClassName='Shell_TrayWnd']",
            "//*[@ClassName='Shell_TrayWnd']//Button",
            "//Button[contains(@Name, 'Start')]",
            "//*[starts-with(@Name, 'Documents')]",
            "//*[@ClassName='CabinetWClass']",
            "//*[@ClassName='CabinetWClass']//ListItem",
            "//Window[contains(@Name, 'File Explorer')]",
            "//*[@FrameworkId='Win32']",
            "//*[@FrameworkId='XAML']",
            "//*[@FrameworkId='DirectUI']",
            "//Window[@IsPassword='False']",
            "//*[@LocalizedControlType='window']",
            "//*[@LocalizedControlType='button']",
            "//*[@LocalizedControlType='edit']",
            "//*[@LocalizedControlType='text']",
            "//*[@LocalizedControlType='menu bar']",
            "//Window/Button",
            "//Window//Button",
            "//*[@ClassName='Chrome_WidgetWin_1' and @IsEnabled='True']",
            "//*[contains(@Name, 'Settings') or contains(@Name, 'Control Panel')]",
            "//*[starts-with(@AutomationId, 'num') or starts-with(@AutomationId, 'btn')]",
            "//Window[position()=1]",
            "//Window[last()]",
            "//*[@ClassName='TrayNotifyWnd']",
            "//*[@ClassName='TrayNotifyWnd']/*",
            "//*[@ClassName='Shell_TrayWnd']//Toolbar",
            "//Window[@ClassName='CabinetWClass']//Button[@Name='Close']",
            "//Window[@ClassName='CabinetWClass']//Button[@Name='Minimize']",
            "//Window[@ClassName='CabinetWClass']//Button[@Name='Maximize']",
            "//*[string-length(@Name) > 50]",
            "//*[string-length(@ClassName) > 20]",
            "//*[@Name!='' and @ClassName!='']",
            "//*[@HelpText and @HelpText!='']",
            "//*[contains(@ClassName, 'Window') and @IsKeyboardFocusable='True']",
            "//Window//Pane//Edit",
            "//Window//Pane//Button",
            "//*[@AccessKey and @AccessKey!='']",
            "//*[@AcceleratorKey and @AcceleratorKey!='']",
            "//*[@ItemStatus and @ItemStatus!='']",
            "//*[@ItemType and @ItemType!='']",
            "//*[@Orientation='Horizontal' or @Orientation='Vertical']",
            "//*[@ProcessId > 0]",
            "//*[@HasKeyboardFocus='True']",
            "//*[starts-with(@Name, 'A') and contains(@ClassName, 'W')]"
        ]

        complex_attrs = [
            "LegacyIAccessible.ChildId",
            "LegacyIAccessible.DefaultAction",
            "LegacyIAccessible.Description",
            "LegacyIAccessible.Help",
            "LegacyIAccessible.KeyboardShortcut",
            "LegacyIAccessible.Name",
            "LegacyIAccessible.Role",
            "LegacyIAccessible.State",
            "LegacyIAccessible.Value",
            "Transform.CanMove",
            "Transform.CanResize",
            "Transform.CanRotate",
            "Window.CanMaximize",
            "Window.CanMinimize",
            "Window.IsModal",
            "Window.IsTopmost",
            "Window.WindowInteractionState",
            "Window.WindowVisualState"
        ]

        results = []
        for i, xpath in enumerate(xpaths, 1):
            time.sleep(1) # Breathe
            start_time = time.time()
            try:
                elements = self.driver.find_elements(AppiumBy.XPATH, xpath)
                elapsed = time.time() - start_time
                count = len(elements)
                print(f"[{i:02d}/50] Found {count:4d} elements in {elapsed:6.2f}s | XPath: {xpath}")
                
                if count > 0:
                    first_el = elements[0]
                    print(f"      Properties for first element:")
                    for attr in complex_attrs:
                        try:
                            val = first_el.get_attribute(attr)
                            if val:
                                print(f"        {attr}: {val}")
                        except:
                            pass
                
                results.append({"xpath": xpath, "count": count, "time": elapsed, "error": None})
            except Exception as e:
                elapsed = time.time() - start_time
                print(f"[{i:02d}/50] ERROR after {elapsed:6.2f}s | XPath: {xpath} | Error: {str(e)}")
                results.append({"xpath": xpath, "count": 0, "time": elapsed, "error": str(e)})

        # Summary of Performance
        total_time = sum(r['time'] for r in results)
        avg_time = total_time / len(results) if results else 0
        print(f"\n--- PERFORMANCE SUMMARY ---")
        print(f"Total XPaths tested: {len(results)}")
        print(f"Total time: {total_time:.2f}s")
        print(f"Average time per find: {avg_time:.2f}s")
        print(f"Max time: {max(r['time'] for r in results):.2f}s")
        print(f"Min time: {min(r['time'] for r in results):.2f}s")

    def test_attribute_retrieval_with_data(self):
        print("\n=== STARTING ATTRIBUTE RETRIEVAL (WITH DATA) ===")
        
        # 1. Target a window that definitely has a name and class
        try:
            chrome_window = self.driver.find_element(AppiumBy.XPATH, "//Window[@ClassName='Chrome_WidgetWin_1' and contains(@Name, 'appium-novawindows2-driver')]")
            
            attrs_to_test = ["Name", "ClassName", "AutomationId", "LocalizedControlType", "FrameworkId", "all"]
            for attr in attrs_to_test:
                val = chrome_window.get_attribute(attr)
                if attr == "all":
                    print(f"Attribute 'all' length: {len(val)}")
                    # Sample some nested data if possible
                    try:
                        data = json.loads(val)
                        print(f"  - Keys in 'all': {list(data.keys())[:10]}...")
                        if "LegacyIAccessible.Role" in data:
                            print(f"  - LegacyIAccessible.Role: {data['LegacyIAccessible.Role']}")
                    except:
                        print("  - Could not parse 'all' as JSON")
                else:
                    print(f"Attribute '{attr}': {val}")
        except Exception as e:
            print(f"Could not find Chrome window for attribute test: {e}")

        # 2. Target Taskbar Start button for Name/Role
        try:
            start_btn = self.driver.find_element(AppiumBy.XPATH, "//Button[contains(@Name, 'Start')]")
            print(f"\nFound Start Button:")
            print(f"  - Name: {start_btn.get_attribute('Name')}")
            print(f"  - LegacyRole: {start_btn.get_attribute('LegacyIAccessible.Role')}")
        except:
            print("\nCould not find Start button")

if __name__ == "__main__":
    test = TestPerformanceAndXPath()
    test.setup_method(None)
    try:
        test.test_expanded_xpath_performance()
        test.test_attribute_retrieval_with_data()
    finally:
        test.teardown_method(None)
