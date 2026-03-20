# Screen Recording

The driver supports recording the screen during a test session using **FFmpeg** (via `gdigrab` for Windows desktop capture).

> **Note:** Screen recording requires the `ffmpeg-static` package to be installed. On ARM machines or unsupported architectures, `ffmpeg-static` may not be available and screen recording will not work.

---

## `startRecordingScreen(options?)`

**Extension command:** `windows: startRecordingScreen`

Starts capturing the screen. If a recording is already in progress, it is stopped first.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fps` | `number` | `15` | Frames per second for the video output |
| `timeLimit` | `number` | `600` (10 min) | Maximum recording duration in seconds |
| `preset` | `string` | `"veryfast"` | FFmpeg H.264 encoding preset (affects quality/speed trade-off). Values: `ultrafast`, `superfast`, `veryfast`, `faster`, `fast`, `medium`, `slow`, `slower`, `veryslow` |
| `captureCursor` | `boolean` | `false` | Whether to capture the mouse cursor in the video |
| `captureClicks` | `boolean` | `false` | Whether to visually highlight mouse clicks in the video |
| `audioInput` | `string` | — | Name of the audio input device for audio recording (e.g. `"Microphone (Realtek Audio)"`) |
| `videoFilter` | `string` | — | Custom FFmpeg `-filter:v` argument (e.g. `"scale=1280:720"`) |

```python
# Basic recording
driver.execute_script("windows: startRecordingScreen", [{}])

# High quality with cursor visible
driver.execute_script("windows: startRecordingScreen", [{
    "fps": 30,
    "preset": "fast",
    "captureCursor": True,
    "captureClicks": True,
    "timeLimit": 300
}])
```

---

## `stopRecordingScreen(uploadOptions?)`

**Extension command:** `windows: stopRecordingScreen`

Stops the current screen recording and returns the captured video.

### Upload Options

| Option | Type | Default | Description |
|---|---|---|---|
| `remotePath` | `string` | — | If provided, the video is uploaded to this URL via HTTP PUT (by default) |
| `user` | `string` | — | HTTP Basic Auth username for the upload |
| `pass` | `string` | — | HTTP Basic Auth password for the upload |
| `method` | `string` | `"PUT"` | HTTP method for the upload |
| `headers` | `object` | — | Custom HTTP headers for the upload request |
| `fileFieldName` | `string` | — | Form field name when using `multipart/form-data` upload |
| `formFields` | `object\|array` | — | Additional form fields for `multipart/form-data` upload |

### Return value

- If `remotePath` is **not** set: returns the video as a **base64-encoded MP4 string**.
- If `remotePath` **is** set: uploads the file and returns an empty string `""`.

```python
# Stop and get base64
b64_video = driver.execute_script("windows: stopRecordingScreen", [{}])

# Decode and save to disk
import base64

with open("recording.mp4", "wb") as f:
    f.write(base64.b64decode(b64_video))

# Stop and upload to remote
driver.execute_script("windows: stopRecordingScreen", [{
    "remotePath": "https://example.com/upload/video.mp4",
    "user": "admin",
    "pass": "secret"
}])
```

---

## Full Workflow Example

```python
import base64
from appium import webdriver
from appium.options import AppiumOptions

options = AppiumOptions()
options.platform_name = "Windows"
options.automation_name = "NovaWindows2"
options.app = r"C:\Windows\System32\notepad.exe"

driver = webdriver.Remote("http://localhost:4723", options=options)

# --- Start recording ---
driver.execute_script("windows: startRecordingScreen", [{
    "fps": 15,
    "captureCursor": True,
    "timeLimit": 120
}])

# --- Do your test actions ---
edit = driver.find_element("xpath", "//Edit")
edit.send_keys("Hello from Appium!")

# --- Stop recording ---
b64 = driver.execute_script("windows: stopRecordingScreen", [{}])
with open("test_recording.mp4", "wb") as f:
    f.write(base64.b64decode(b64))

driver.quit()
```

---

## Notes

- The recording is saved to a temp file on the Windows machine during capture.
- The temp file is deleted after `stopRecordingScreen` completes (whether returned as base64 or uploaded).
- If the session ends while a recording is in progress (e.g., due to a crash), the recording is forcefully stopped and the temporary file is cleaned up automatically.
- The video uses the `libx264` codec with YUV 4:2:0 pixel format for broad compatibility.
- The `movflags +faststart` flag is used so the video is streamable without needing to download the full file.
