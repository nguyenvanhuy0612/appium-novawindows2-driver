
import { UIAClient, PVOID, VARIANT } from '../../lib/winapi/uia';
import { decode, proto, struct, pointer } from 'koffi';

async function main() {
    console.log('Brute forcing CreatePropertyCondition index...');

    const client = new UIAClient();
    const autoPtr = (client as any).automation;
    const vptr = decode(autoPtr, PVOID);

    console.log("VTable Pointer:", vptr);

    const CreatePropertyConditionSig = proto('HRESULT __stdcall (void *this, int propertyId, void *value, void **newCondition)');
    const method = (sig: string) => pointer(proto(sig));

    // Define a massive struct to map VTable entries
    // We assume 3 (IUnknown) + ~50 methods.
    const entries: any = {};
    for (let i = 0; i < 60; i++) {
        entries[`func${i}`] = 'void*'; // Generic pointer
    }
    const BigVTable = struct('BigVTable', entries);

    console.log("Decoding BigVTable...");
    const vtable = decode(vptr, BigVTable);

    // Prepare dummy VARIANT
    const koffi = require('koffi');
    const variantPtr = koffi.alloc(VARIANT);
    const variantObj = {
        vt: 3, // VT_I4
        wReserved1: 0, wReserved2: 0, wReserved3: 0,
        data: { lVal: 50033 }
    };
    koffi.encode(variantPtr, VARIANT, variantObj);
    const condPtrBuf = Buffer.alloc(8);

    // Indices to test: 15 to 35
    for (let i = 15; i < 35; i++) {
        console.log(`Testing Index ${i}...`);
        const funcPtr = vtable[`func${i}`];
        if (!funcPtr) {
            console.log(`Index ${i} is null.`);
            continue;
        }

        try {
            console.log(`Calling Index ${i}: ${funcPtr}`);
            // Decode as CreatePropertyCondition signature
            const func = decode(funcPtr, CreatePropertyConditionSig);

            // Invoke
            const res = func(autoPtr, 30003, variantPtr, condPtrBuf);

            console.log(`Index ${i} returned: ${res}`);

            if (res === 0) {
                console.log(`SUCCESS! Index ${i} returned S_OK.`);
                // Verify if output looks like a pointer?
                console.log('Condition Pointer:', condPtrBuf);
                break;
            }
        } catch (e) {
            console.log(`Index ${i} CRASHED/Error.`);
        }
        console.log('--------------------------------');
    }
}

main();
