const { UIAClient } = require('../../build/lib/winapi/uia');

async function testHandle() {
    try {
        const client = new UIAClient();
        const hwnd = client.getDesktopWindow();
        console.log('Desktop HWND:', hwnd);

        console.log('Getting element from handle...');
        const rootFromHandle = client.elementFromHandle(hwnd);
        console.log('Root from handle Name:', rootFromHandle.getName());

        console.log('Comparing with GetRootElement()...');
        const root = client.getRootElement();
        console.log('Standard Root Name:', root.getName());

    } catch (e) {
        console.error('Test failed:', e);
    }
}

testHandle();
