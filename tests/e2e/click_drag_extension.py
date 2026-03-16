from appium import webdriver
from appium.options.common.base import AppiumOptions
import time

def run_test():
    options = AppiumOptions()
    options.load_capabilities({
        "platformName": "Windows",
        "appium:automationName": "NovaWindows2",
        "appium:app": "Root",
        "appium:newCommandTimeout": 300,
        "appium:hostname": "192.168.8.245",
        "appium:port": 4723,
    })

    driver = webdriver.Remote("http://192.168.8.245:4723", options=options)
    try:
        print("Session started")

        # Test 1: Default Left Drag
        # Drag from (100, 100) to (400, 400)
        # print("Testing default clickAndDrag (Left)...")
        # driver.execute_script("windows: clickAndDrag", {
        #     "startX": 191,
        #     "startY": 331,
        #     "endX": 1000,
        #     "endY": 200,
        #     "durationMs": 200
        # })
        # time.sleep(1)

        # # Test 2: Right Drag
        # # Drag from (400, 400) back to (100, 100) with Right Button
        print("Testing Right clickAndDrag...")
        driver.execute_script("windows: clickAndDrag", {
            "startX": 191,
            "startY": 331,
            "endX": 959,
            "endY": 229,
            "button": "right",
            "durationMs": 1000,
            "smoothPointerMove": "linear"
        })

        # print("Tests completed successfully.")
        #time.sleep(2)

    except Exception as e:
        print(f"Test Failed: {e}")
    finally:
        driver.quit()
        print("Session ended")

if __name__ == "__main__":
    run_test()
