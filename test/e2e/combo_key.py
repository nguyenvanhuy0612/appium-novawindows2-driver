from appium import webdriver
from appium.options.common.base import AppiumOptions
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
import time

def run_test_via_action_chain():
    options = AppiumOptions()
    options.load_capabilities({
        "platformName": "Windows",
        "appium:automationName": "NovaWindows2",
        "appium:app": "Root",
        "appium:newCommandTimeout": 300,
        "appium:hostname": "192.168.8.245",
    })

    # The user's JS test used a specific IP, using that here.
    driver = webdriver.Remote("http://192.168.8.245:4723", options=options)

    try:
        print("Session started")
        
        # Windows + Left Key
        # Keys.META is the Command/Windows key
        print("Sending Windows + Left Arrow combination...")
        
        actions = ActionChains(driver)
        actions.key_down(Keys.META)
        actions.key_down(Keys.LEFT)
        actions.pause(0.1)
        actions.key_up(Keys.LEFT)
        actions.key_up(Keys.META)
        actions.perform()

        print("Key combination sent.")
        time.sleep(2)

    except Exception as e:
        print(f"Test Failed: {e}")
    finally:
        driver.quit()
        print("Session ended")

def run_test_via_windows_keys():
    options = AppiumOptions()
    options.load_capabilities({
        "platformName": "Windows",
        "appium:automationName": "Windows",
        "appium:app": "Root",
        "appium:newCommandTimeout": 300,
        "appium:hostname": "192.168.8.245",
    })

    driver = webdriver.Remote("http://192.168.8.245:4723", options=options)
    try:
        print("Session started")
        
        # Windows Key = 0x5B (VK_LWIN)
        # Left Arrow = 0x25 (VK_LEFT)
        print("Sending Windows + Left Arrow using windows: keys...")
        
        # Execute 'windows: keys' with raw virtual key codes
        driver.execute_script("windows: keys", {
            "actions": [
                {"virtualKeyCode": 0x5B, "down": True},  # Windows Down
                {"virtualKeyCode": 0x25, "down": True},  # Left Arrow Down
                {"pause": 100},
                {"virtualKeyCode": 0x25, "down": False}, # Left Arrow Up
                {"virtualKeyCode": 0x5B, "down": False}  # Windows Up
            ]
        })
        
        print("Key combination sent.")
        time.sleep(2)

    except Exception as e:
        print(f"Test Failed: {e}")
    finally:
        driver.quit()
        print("Session ended")

if __name__ == "__main__":
    #run_test_via_action_chain()
    run_test_via_windows_keys()
