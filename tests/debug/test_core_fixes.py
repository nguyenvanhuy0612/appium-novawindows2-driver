import unittest
import time
from appium import webdriver
from appium.options.common.base import AppiumOptions
from selenium.common.exceptions import InvalidSelectorException

class TestCoreLibraryFixes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        options = AppiumOptions()
        options.set_capability("platformName", "Windows")
        options.set_capability("appium:automationName", "NovaWindows2")
        options.set_capability("appium:app", "Root") # Testing against the entire desktop
        
        cls.driver = webdriver.Remote("http://172.16.10.37:4723", options=options)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def test_01_simple_property_lookup(self):
        """Verify that simple property names (Name, AutomationId) work correctly."""
        print("\n[Test 01] Testing simple property lookup (Name)...")
        # Try to find the Taskbar by Name
        try:
            # Using new PropertyCondition(Name, "Taskbar") or similar
            # Note: Taskbar name might be localized, class name is safer for generic check
            selector = 'new PropertyCondition(ClassName, "Shell_TrayWnd")'
            element = self.driver.find_element("-windows uiautomation", selector)
            self.assertIsNotNone(element)
            print("Successfully found Taskbar using simple ClassName property.")
        except Exception as e:
            self.fail(f"Failed to find element using simple property: {e}")

    def test_02_control_type_mapping(self):
        """Verify that ControlType.List maps to OrCondition(List, DataGrid)."""
        print("\n[Test 02] Testing ControlType mapping (List/ListItem)...")
        try:
            # This should trigger the OrCondition mapping in converter.ts
            selector = 'new PropertyCondition(ControlType, List)'
            # If any list exists on the desktop, this should find it.
            elements = self.driver.find_elements("-windows uiautomation", selector)
            print(f"Found {len(elements)} list-like elements.")
            # Even if 0, the selector itself should be valid and not throw
        except Exception as e:
            self.fail(f"Failed to execute ControlType.List selector: {e}")

    def test_03_disallow_dot_prefix(self):
        """Verify that AutomationElement. prefix is no longer allowed."""
        print("\n[Test 03] Verifying dot-prefix is disallowed...")
        selector = 'new PropertyCondition(AutomationElement.NameProperty, "Calc")'
        with self.assertRaises(InvalidSelectorException) as cm:
            self.driver.find_element("-windows uiautomation", selector)
        
        print(f"Caught expected exception: {cm.exception.msg}")
        self.assertIn("Could not parse", cm.exception.msg)

    def test_04_complex_nested_condition(self):
        """Verify deeply nested And/Or conditions."""
        print("\n[Test 04] Testing nested And/Or conditions...")
        # (ClassName == 'Shell_TrayWnd' AND Name == 'Taskbar') OR (AutomationId == 'SearchIcon')
        # We just want to ensure the PARSER handles it without error.
        selector = """
        new OrCondition(
            new AndCondition(
                new PropertyCondition(ClassName, "Shell_TrayWnd"),
                new PropertyCondition(Name, "Taskbar")
            ),
            new PropertyCondition(AutomationId, "SearchIcon")
        )
        """
        try:
            # We don't strictly care if it finds anything, just that it doesn't crash the driver/parser
            self.driver.find_elements("-windows uiautomation", selector)
            print("Successfully parsed complex nested condition.")
        except Exception as e:
            self.fail(f"Failed to parse complex condition: {e}")

if __name__ == "__main__":
    unittest.main()
