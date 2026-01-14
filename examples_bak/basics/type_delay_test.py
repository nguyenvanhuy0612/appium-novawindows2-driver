from appium import webdriver
from appium.options.common.base import AppiumOptions
import time

def main():
    options = AppiumOptions()
    options.load_capabilities({
        "appium:automationName": "NovaWindows2",
        "platformName": "Windows",
        "appium:app": "Root",
        "appium:typeDelay": 500  # Start with slow global delay (500ms)
    })

    driver = webdriver.Remote(
        command_executor='http://172.16.1.52:4723',
        options=options
    )

    try:
        element = driver.find_element(by='xpath', value="//Document[@Name='Text Editor']")
        element.click() # Ensure focus
        
        print("1. Typing with configured delay (500ms) - Should be slow")
        element.send_keys("Slow_")
        time.sleep(1)

        print("2. Using inline delay [delay:10] to override global delay - Should be FAST")
        # This tests the user's specific request: global > 0 but inline is fast
        element.send_keys("[delay:10]Fast_")
        time.sleep(1)

        print("3. Verifying global delay (500ms) persists - Should be slow again")
        element.send_keys("SlowAgain_")
        time.sleep(1)

        print("4. Changing global delay to 0ms using extension")
        driver.execute_script('windows: typeDelay', {'delay': 0})
        
        print("   Typing... (should be fast)")
        element.send_keys("FastFinal_")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
