from appium import webdriver
from appium.options.common.base import AppiumOptions
from selenium.webdriver.common.actions.action_builder import ActionBuilder
from selenium.webdriver.common.actions.mouse_button import MouseButton
from selenium.webdriver.common.actions.pointer_input import PointerInput
from selenium.webdriver.common.actions import interaction
import time

def run_right_drag_test():
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
        
        print("Performing Right-Click Drag...")
        
        # Create a PointerInput for the mouse
        mouse = PointerInput(interaction.POINTER_MOUSE, "mouse")
        actions = ActionBuilder(driver, mouse=mouse)
        
        # 1. Move to start position (100, 100)
        actions.pointer_action.move_to_location(100, 100)
        
        # 2. Press Right Button (Button 2)
        # MouseButton.RIGHT is typically 2
        actions.pointer_action.pointer_down(MouseButton.RIGHT)
        
        # 3. Drag to end position (400, 400)
        actions.pointer_action.pause(0.5) 
        actions.pointer_action.move_to_location(400, 400)
        actions.pointer_action.pause(0.5)
        
        # 4. Release Right Button
        actions.pointer_action.pointer_up(MouseButton.RIGHT)
        
        actions.perform()
        
        print("Right-Click Drag performed.")
        time.sleep(2)

    except Exception as e:
        print(f"Test Failed: {e}")
    finally:
        driver.quit()
        print("Session ended")

if __name__ == "__main__":
    run_right_drag_test()
