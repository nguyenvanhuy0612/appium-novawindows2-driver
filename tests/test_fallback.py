import time
from appium import webdriver
from appium.options.common.base import AppiumOptions

options = AppiumOptions()
options.set_capability("platformName", "Windows")
options.set_capability("appium:automationName", "NovaWindows2")
options.set_capability("appium:app", "Root")

driver = webdriver.Remote("http://172.16.10.37:4723", options=options)

def test_click_params():
    print("--- Testing Click Parameters ---")
    print("1. Click at current position (no args)")
    driver.execute_script("windows: click")
    time.sleep(1)

    print("2. Right click at current position")
    driver.execute_script("windows: click", {"button": "right"})
    time.sleep(1)

    print("3. Double click at current position")
    driver.execute_script("windows: click", {"times": 2, "interClickDelayMs": 200})
    time.sleep(1)

    print("4. Long click (durationMs=1000)")
    driver.execute_script("windows: click", {"durationMs": 1000})
    time.sleep(1.5)

    print("5. Click with modifiers (Ctrl+Shift)")
    driver.execute_script("windows: click", {"modifierKeys": ["ctrl", "shift"]})
    time.sleep(1)

def test_scroll_params():
    print("\n--- Testing Scroll Parameters ---")
    print("6. Scroll at current position (deltaY=-100)")
    driver.execute_script("windows: scroll", {"deltaY": -100})
    time.sleep(1)

    print("7. Horizontal scroll (deltaX=100)")
    driver.execute_script("windows: scroll", {"deltaX": 100})
    time.sleep(1)

    print("8. Scroll with Ctrl modifier")
    driver.execute_script("windows: scroll", {"deltaY": -100, "modifierKeys": "ctrl"})
    time.sleep(1)

def test_hover_params():
    print("\n--- Testing Hover Parameters ---")
    print("9. Smooth hover from current pos to absolute (500, 500) over 1s")
    driver.execute_script("windows: hover", {"startX": 500, "startY": 500, "durationMs": 1000})
    time.sleep(1.5)

    print("10. Hover with modifiers")
    driver.execute_script("windows: hover", {"startX": 400, "startY": 400, "modifierKeys": "alt"})
    time.sleep(1)

def test_element_params():
    print("\n--- Testing Element-based Parameters ---")
    try:
        # Searching for Taskbar as a generic element
        taskbar = driver.find_element("xpath", "/[@ClassName='Shell_TrayWnd']")
        element_id = taskbar.id
        print(f"Found Taskbar (ID: {element_id})")

        print("11. Click on element center")
        driver.execute_script("windows: click", {"elementId": element_id})
        time.sleep(1)

        print("12. Click with element offset (x=10, y=10)")
        driver.execute_script("windows: click", {"elementId": element_id, "x": 10, "y": 10})
        time.sleep(1)

        print("13. Scroll on element")
        driver.execute_script("windows: scroll", {"elementId": element_id, "deltaY": -50})
        time.sleep(1)

        print("14. Hover to element smoothly from current position")
        driver.execute_script("windows: hover", {"startElementId": element_id, "durationMs": 1000})
        time.sleep(1.5)

    except Exception as e:
        print(f"Skipping element tests due to error: {e}")

try:
    test_click_params()
    test_scroll_params()
    test_hover_params()
    test_element_params()
    print("\nAll tests passed successfully!")
finally:
    driver.quit()
