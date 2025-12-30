const { UIAClient, PVOID } = require('../../build/lib/winapi/uia');
const koffi = require('koffi');

async function probeIndices() {
    try {
        const client = new UIAClient();
        const root = client.getRootElement();
        const automation = client.automation;
        const trueCond = client.createTrueCondition();

        console.log('Probing FindFirst/FindAll indices on root...');
        const vtablePtr = koffi.decode(root.element, 'void *');
        const vtable = koffi.decode(vtablePtr, 'void *[100]'); // Read many slots

        const proto = koffi.proto('HRESULT __stdcall (void *, int, void *, void **)');
        for (let i = 5; i <= 15; i++) {
            try {
                // Try calling as FindFirst: (this, scope, condition, found)
                const func = koffi.decode(vtable[i], proto);
                const buf = Buffer.alloc(8);
                const res = func(root.element, 2, trueCond, buf);
                const ptr = koffi.decode(buf, 'void *');
                console.log(`Index ${i}: Res=${res}, Ptr=${ptr ? 'Set' : 'Null'}`);
            } catch (e) {
                console.log(`Index ${i}: Crash/Error ${e.message}`);
            }
        }
    } catch (e) {
        console.error('Probe failed:', e);
    }
}

probeIndices();
