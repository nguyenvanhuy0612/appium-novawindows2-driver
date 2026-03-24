# This file is used to test the changes made in the lib/ directory
# To deploy the changes, run: .\scripts\local\build_deploy_restart.ps1
# Run this file using: conda run -n py313 python tests/dev_24Mar/test_changes.py
# Run a specific test: conda run -n py313 python tests/dev_24Mar/test_changes.py TestChanges.test_item

import unittest
from appium import webdriver
from appium.options.windows import WindowsOptions

class TestChanges(unittest.TestCase):
    def setUp(self):
        options = WindowsOptions()
        options.load_capabilities({
            "appium:automationName": "NovaWindows2",
            "appium:app": "Root",
            "appium:newCommandTimeout": 60
        })
        self.driver = webdriver.Remote("http://192.168.196.128:4723", options=options)
        print('Connected to Appium server')

    def tearDown(self):
        self.driver.quit()

    def test_item(self):
        els = self.driver.find_elements(by="xpath", value="//Window[contains(@Name, 'SecureAge')]//ListItem")
        print(len(els))
        
        print(els[0].get_attribute("LegacyIAccessible.Description"))
        print(els[0].get_attribute("all"))

    def test_buttons(self):
        els = self.driver.find_elements(by="xpath", value="//Button")
        print(len(els))
        for el in els:
            print(el.get_attribute("all"))

if __name__ == "__main__":
    unittest.main()