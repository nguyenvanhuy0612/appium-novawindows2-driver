# NovaWindows2 E2E Test Cases (Total Coverage)

This file lists all test cases including exhaustive permutations and internal command mapping.

## 1. Session & App Management (`app.e2e.spec.ts`)
- [x] `getPageSource`
- [x] `getScreenshot`
- [x] `getTitle`
- [x] `getWindowHandle` / `getWindowHandles`
- [x] `getWindowRect` / `setWindowRect`
- [x] `maximizeWindow` / `minimizeWindow`
- [x] `launchApp` / `closeApp`
- [x] `setWindow` (Window switching)
- [x] Capability Validation (delayAfterClick, smoothPointerMove, etc.)

## 2. Element Discovery (`search.e2e.spec.ts`)
- [x] XPath, Tag Name, Name, Accessibility ID, Class Name, ID.
- [x] `-windows uiautomation` (PowerShell conditions).
- [x] `findElementFromElement`: nested search.
- [x] `active`: currently focused element.

## 3. Element State & Properties (`element.e2e.spec.ts`)
- [x] Name, Text, Rect, Displayed, Enabled, Selected.
- [x] `getProperty` / `getAttribute`:
    - Direct UIA properties (AutomationId, ClassName).
    - Pattern properties (Window.CanMaximize).
    - Legacy properties (LegacyIAccessible.Name).
    - Element source XML (source).
    - All properties JSON (all).
- [x] `takeElementScreenshot`.
- [x] `windows: getAttributes`: Full JSON property dump.

## 4. User Interactions (`interaction.e2e.spec.ts`)
- [x] `click`, `clear`, `setValue`.
- [x] `performActions`:
    - Pointer: Move (viewport, pointer, element), Down, Up.
    - Key: Down, Up, Pause, Modifiers.
    - Wheel: Scroll (deltaX, deltaY).
- [x] `releaseActions`.

## 5. UIA Pattern Extensions (`patterns.e2e.spec.ts`)
- [x] `windows: invoke`
- [x] `windows: expand` / `windows: collapse`
- [x] `windows: toggle`
- [x] `windows: select`, `addToSelection`, `removeFromSelection`
- [x] `windows: selectedItem`, `allSelectedItems`
- [x] `windows: isMultiple` (Selection pattern)
- [x] `windows: setValue`, `getValue` (Pattern-based)
- [x] `windows: maximize`, `minimize`, `restore`, `close`
- [x] `windows: scrollIntoView`

## 6. Advanced Input Permutations (`advanced_input.e2e.spec.ts`)
- [x] `windows: click` (Element center, offset, absolute, current pos, buttons, modifiers, multi-click, duration).
- [x] `windows: hover` (Element, coordinate, start-to-end).
- [x] `windows: scroll` (DeltaX, DeltaY, at Element).
- [x] `windows: keys` (Virtual keys, text, pauses).
- [x] `windows: clickAndDrag` (Element-to-element, coordinate-to-coordinate).
- [x] `windows: setFocus`.
- [x] `windows: typeDelay`.

## 7. Clipboard & Files (`system.e2e.spec.ts`)
- [x] Clipboard: Plaintext set/get.
- [x] Clipboard: Image (base64) set/get.
- [x] File: `pushFile`, `pullFile`.
- [x] Folder: `pullFolder` (ZIP).
- [x] `getOrientation`.

## 8. PowerShell & System (`powershell.e2e.spec.ts`)
- [x] `windows: powershell`: Execute raw scripts.
- [x] `getDeviceTime`.
- [x] `windows: activateProcess`: Set foreground by PID or Window Name.

## 9. Screen Recording (`recording.e2e.spec.ts`)
- [x] Start/Stop recording with options (fps, timeLimit, captureCursor).

## 10. Cache Management (`cache.e2e.spec.ts`)
- [x] `windows: cacheRequest` (TreeScope, AutomationElementMode, TreeFilter).
