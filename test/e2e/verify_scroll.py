from appium import webdriver
from appium.options.common.base import AppiumOptions
import time

def main():
    options = AppiumOptions()
    options.load_capabilities({
        "appium:automationName": "NovaWindows2",
        "platformName": "Windows",
        "appium:app": "Root"
    })

    driver = webdriver.Remote(
        command_executor='http://172.16.10.37:4723',
        options=options
    )

    try:
        print("1. Scrolling down (deltaY=-100)...")
        # execute_script 'windows: scroll', {'deltaY': -100}
        driver.execute_script('windows: scroll', {'x': 500, 'y': 500, 'deltaY': -100})
        time.sleep(1)

        print("2. Scrolling up (deltaY=100)...")
        driver.execute_script('windows: scroll', {'x': 500, 'y': 500, 'deltaY': 100})
        time.sleep(1)

        print("Scroll commands executed successfully (no errors thrown).")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
