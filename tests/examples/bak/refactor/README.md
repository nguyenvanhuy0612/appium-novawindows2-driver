# Refactored Examples

This directory contains comprehensive examples demonstrating the features of the NovaWindows2 Driver.

## Files

- `comprehensive_test.py`: A PyTest-based script that covers:
  - **Session Setup**: initializing UWP, Classic Win32, and Root sessions.
  - **Element Location**: using Strategies like Accessibility ID, Class Name, XPath, Tag Name, and Windows UIAutomation.
  - **Attribute Retrieval**: demonstrating standard, bulk (`"all"`), and dotted property access.
  - **PowerShell Execution**: executing commands and scripts using various formats.
  - **Platform Extensions**: examples of advanced mouse clicks, keyboard input, clipboard management, and window control.

## Running the Examples

Ensure you have `pytest` and `Appium-Python-Client` installed:

```bash
pip install pytest Appium-Python-Client
```

Run the test:

```bash
pytest comprehensive_test.py
```
