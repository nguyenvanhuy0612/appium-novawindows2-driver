
import pytest
import base64
from appium import webdriver
from appium.options.windows import WindowsOptions
from appium.webdriver.common.appiumby import AppiumBy

def generate_options():
    # 1. UWP App Example (Calculator)
    uwp_options = WindowsOptions()
    uwp_options.app = 'Microsoft.WindowsCalculator_8wekyb3d8bbwe!App'
    uwp_options.automation_name = 'NovaWindows2'
    
    # 2. Classic Win32 App Example (Notepad)
    classic_options = WindowsOptions()
    classic_options.app = r'C:\Windows\System32\notepad.exe'
    classic_options.automation_name = 'NovaWindows2'

    # 3. Root Session (Desktop)
    root_options = WindowsOptions()
    root_options.app = 'Root'
    root_options.automation_name = 'NovaWindows2'

    return [uwp_options, classic_options, root_options]

@pytest.fixture(params=generate_options())
def driver(request):
    drv = webdriver.Remote('http://127.0.0.1:4723', options=request.param)
    yield drv
    drv.quit()

def test_comprehensive_features(driver):
    # --- Element Location Strategies ---
    
    # By Accessibility ID (AutomationId)
    if "Calculator" in str(driver.capabilities.get('app', '')):
        el = driver.find_element(AppiumBy.ACCESSIBILITY_ID, "num5Button")
        el.click()
    
    # By Class Name
    # el = driver.find_element(AppiumBy.CLASS_NAME, "Button")

    # By Name
    # el = driver.find_element(AppiumBy.NAME, "Five")

    # By Tag Name (LocalizedControlType)
    # el = driver.find_element(AppiumBy.TAG_NAME, "Button")

    # By XPath
    # el = driver.find_element(AppiumBy.XPATH, "//Button[@Name='Five']")

    # --- Windows UIAutomation ---
    # el = driver.find_element(AppiumBy.WINDOWS_UI_AUTOMATION, 'new PropertyCondition(AutomationElement.NameProperty, "Five")')


    # --- Attribute Retrieval ---
    
    # Standard 
    # print(el.get_attribute("Name"))

    # Bulk Retrieval
    # all_attrs = el.get_attribute("all")
    # print(all_attrs)

    # Dotted Access
    # can_max = el.get_attribute("Window.CanMaximize")
    

    # --- PowerShell Execution ---
    
    # Helper to print PS output
    def run_ps(args):
        try:
            return driver.execute_script('powerShell', args)
        except Exception as e:
            return str(e)

    # 1. Command Object
    print(run_ps({'command': 'Get-Process Notepad -ErrorAction SilentlyContinue'}))

    # 2. Script Object
    print(run_ps({'script': '$a = 1; $b = 2; $a + $b'}))

    # 3. Direct String (Shorthand)
    print(run_ps('Get-Date'))


    # --- Platform-Specific Extensions ---
    
    # Mouse Click (Advanced)
    # driver.execute_script('windows: click', {
    #    'button': 'right', 
    #    'times': 2,
    #    'modifierKeys': ['shift']
    # })

    # Keyboard Input
    # driver.execute_script('windows: keys', {
    #     'actions': [
    #         {'virtualKeyCode': 0x10, 'down': True}, # Shift Down
    #         {'text': 'Hello'},
    #         {'virtualKeyCode': 0x10, 'down': False} # Shift Up
    #     ]
    # })

    # Clipboard
    # driver.execute_script('windows: setClipboard', {'b64Content': base64.b64encode(b'Hello World').decode('utf-8')})
    # content = driver.execute_script('windows: getClipboard', {'contentType': 'plaintext'})
    # print(f"Clipboard: {base64.b64decode(content).decode('utf-8')}")

    # Window Management
    # current_window = driver.find_element(AppiumBy.XPATH, "/*")
    # driver.execute_script("windows: maximize", current_window)
    # driver.execute_script("windows: restore", current_window)

    assert len(driver.page_source) > 0
