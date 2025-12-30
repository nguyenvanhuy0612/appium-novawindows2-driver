
const { UIAClient, CoInitializeEx, COINIT_APARTMENTTHREADED } = require('../build/lib/winapi/uia');

try {
    console.log("Initializing UIAClient...");
    const client = new UIAClient();
    console.log("UIAClient initialized.");

    console.log("Getting Root Element...");
    const root = client.getRootElement();

    console.log("Finding 'Taskbar'...");
    // 30005 is Name Property ID
    const nameId = 30005;
    const taskbar = root.findFirstByProperty(4, nameId, "Taskbar", client); // 4 = Descendants

    if (taskbar) {
        console.log("Taskbar found.");

        try {
            console.log("Name:", taskbar.getName());
            console.log("ClassName:", taskbar.getClassName());
        } catch (e) {
            console.error("Property error:", e);
        }

        console.log("Getting Rect...");
        const rect = taskbar.getBoundingRectangle();
        console.log("Rect:", rect);

        if (rect.right > 0 && rect.bottom > 0) {
            console.log("SUCCESS: Valid Rect retrieved via Native VTable!");
        } else {
            console.warn("WARNING: Rect is zero or invalid.");
        }

    } else {
        console.log("Taskbar NOT found.");
    }

} catch (e) {
    console.error("Error:", e);
}
