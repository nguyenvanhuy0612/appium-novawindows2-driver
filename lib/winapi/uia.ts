
import {
    load,
    proto,
    struct,
    pointer,
    alias,
    union,
    opaque,
    decode,
    alloc,
    encode,
    address,
} from 'koffi';

const ole32 = load('ole32.dll');
const oleaut32 = load('oleaut32.dll');

// Basic Types
export const HRESULT = alias('HRESULT', 'long');
export const VOID = opaque();
export const PVOID = pointer('PVOID', VOID);

// RECT
export const RECT = struct('RECT', {
    left: 'long',
    top: 'long',
    right: 'long',
    bottom: 'long',
});

// BSTR
export const SysAllocString = oleaut32.func('void * __stdcall SysAllocString(str16 psz)');
export const SysFreeString = oleaut32.func('void __stdcall SysFreeString(void * bstr)');

// GUID
export const GUID = struct('GUID', {
    Data1: 'uint32',
    Data2: 'uint16',
    Data3: 'uint16',
    Data4: 'uint8[8]',
});

// CLSID & IID
export const CLSID_CUIAutomation = {
    Data1: 0xff48dba4,
    Data2: 0x60ef,
    Data3: 0x4201,
    Data4: [0xaa, 0x87, 0x54, 0x10, 0x3e, 0xef, 0x59, 0x4e]
};

export const IID_IUIAutomation = {
    Data1: 0x30cbe57d,
    Data2: 0xd9d0,
    Data3: 0x452a,
    Data4: [0xab, 0x13, 0x7a, 0xc5, 0xac, 0x48, 0x25, 0xee]
};

export const IID_IUIAutomationElement = {
    Data1: 0xd22108aa,
    Data2: 0x8ac5,
    Data3: 0x49a5,
    Data4: [0x83, 0x7b, 0x37, 0xbb, 0xb3, 0xd7, 0x59, 0x1e]
};

// Basic VARIANT structure for pass-by-value compatibility
export const VARIANT = struct('VARIANT', {
    vt: 'uint16',
    wReserved1: 'uint16',
    wReserved2: 'uint16',
    wReserved3: 'uint16',
    llVal: 'int64',
    pad: 'int64'
});

export const VT_I4 = 3;
export const VT_BSTR = 8;
export const VT_BOOL = 11;

// Interfaces callbacks
const QueryInterfaceCallback = proto('HRESULT __stdcall (void *this, GUID *riid, void **ppvObject)');
const AddRefCallback = proto('uint32 __stdcall (void *this)');
const ReleaseCallback = proto('uint32 __stdcall (void *this)');

const IUnknownVtbl = struct('IUnknownVtbl', {
    QueryInterface: pointer(QueryInterfaceCallback),
    AddRef: pointer(AddRefCallback),
    Release: pointer(ReleaseCallback),
});

// Helper for VTable methods
const method = (sig: string) => pointer(proto(sig));

// Define Prototypes explicitly for usage in decoding
export const GetRootElementProto = proto('HRESULT __stdcall (void *this, void **root)');
export const FindFirstProto = proto('HRESULT __stdcall (void *this, int scope, void *condition, void **found)');
export const FindAllProto = proto('HRESULT __stdcall (void *this, int scope, void *condition, void **found)');
export const get_LengthProto = proto('HRESULT __stdcall (void *this, int *length)');
export const GetElementProto = proto('HRESULT __stdcall (void *this, int index, void **element)');
export const CreatePropertyConditionProto = proto('HRESULT __stdcall (void *this, int propertyId, VARIANT value, void **newCondition)');
export const CreateTrueConditionProto = proto('HRESULT __stdcall (void *this, void **newCondition)');
export const GetCurrentPropertyValueProto = proto('HRESULT __stdcall (void *this, int propertyId, VARIANT *retVal)');
export const get_CurrentBoundingRectangleProto = proto('HRESULT __stdcall (void *this, RECT *retVal)');

// IUIAutomationElement Interface
export const IUIAutomationElementVtbl = struct('IUIAutomationElementVtbl', {
    // IUnknown
    QueryInterface: pointer(QueryInterfaceCallback), // 0
    AddRef: pointer(AddRefCallback),                 // 1
    Release: pointer(ReleaseCallback),               // 2

    // IUIAutomationElement
    SetFocus: method('HRESULT __stdcall (void *this)'), // 3
    GetRuntimeId: method('HRESULT __stdcall (void *this, void **runtimeId)'), // 4
    FindFirst: pointer(FindFirstProto), // 5
    FindAll: pointer(FindAllProto), // 6
    FindFirstBuildCache: method('HRESULT __stdcall (void *this, int scope, void *condition, void *cacheRequest, void **found)'), // 7
    FindAllBuildCache: method('HRESULT __stdcall (void *this, int scope, void *condition, void *cacheRequest, void **found)'), // 8
    BuildUpdatedCache: method('HRESULT __stdcall (void *this, void *cacheRequest, void **updatedElement)'), // 9
    GetCurrentPropertyValue: pointer(GetCurrentPropertyValueProto), // 10
    GetCurrentPropertyValueEx: method('HRESULT __stdcall (void *this, int propertyId, int ignoreDefaultValue, VARIANT *retVal)'), // 11

    // Padding/Placeholders for 12-40
    GetCachedPropertyValue: method('HRESULT __stdcall (void *this, int propertyId, VARIANT *retVal)'), // 12
    GetCachedPropertyValueEx: method('HRESULT __stdcall (void *this, int propertyId, int ignoreDefaultValue, VARIANT *retVal)'), // 13
    GetCurrentPatternAs: method('HRESULT __stdcall (void *this, int patternId, GUID *riid, void **patternObject)'), // 14
    GetCachedPatternAs: method('HRESULT __stdcall (void *this, int patternId, GUID *riid, void **patternObject)'), // 15
    GetCurrentPattern: method('HRESULT __stdcall (void *this, int patternId, void **patternObject)'), // 16
    GetCachedPattern: method('HRESULT __stdcall (void *this, int patternId, void **patternObject)'), // 17

    Placeholder18: method('HRESULT __stdcall (void *this, void *p1, void *p2)'), // 18
    Placeholder19: method('HRESULT __stdcall (void *this, void *p1)'), // 19

    get_CurrentProcessId: method('HRESULT __stdcall (void *this, int *retVal)'), // 20
    get_CurrentControlType: method('HRESULT __stdcall (void *this, int *retVal)'), // 21
    get_CurrentLocalizedControlType: method('HRESULT __stdcall (void *this, void **retVal)'), // 22
    get_CurrentName: method('HRESULT __stdcall (void *this, void **retVal)'), // 23
    get_CurrentAcceleratorKey: method('HRESULT __stdcall (void *this, void **retVal)'), // 24
    get_CurrentAccessKey: method('HRESULT __stdcall (void *this, void **retVal)'), // 25
    get_CurrentHasKeyboardFocus: method('HRESULT __stdcall (void *this, int *retVal)'), // 26
    get_CurrentIsKeyboardFocusable: method('HRESULT __stdcall (void *this, int *retVal)'), // 27
    get_CurrentIsEnabled: method('HRESULT __stdcall (void *this, int *retVal)'), // 28
    get_CurrentAutomationId: method('HRESULT __stdcall (void *this, void **retVal)'), // 29
    get_CurrentClassName: method('HRESULT __stdcall (void *this, void **retVal)'), // 30
    get_CurrentHelpText: method('HRESULT __stdcall (void *this, void **retVal)'), // 31
    get_CurrentCulture: method('HRESULT __stdcall (void *this, int *retVal)'), // 32
    get_CurrentIsControlElement: method('HRESULT __stdcall (void *this, int *retVal)'), // 33
    get_CurrentIsContentElement: method('HRESULT __stdcall (void *this, int *retVal)'), // 34
    get_CurrentIsPassword: method('HRESULT __stdcall (void *this, int *retVal)'), // 35
    get_CurrentNativeWindowHandle: method('HRESULT __stdcall (void *this, void **retVal)'), // 36
    get_CurrentItemType: method('HRESULT __stdcall (void *this, void **retVal)'), // 37
    get_CurrentIsOffscreen: method('HRESULT __stdcall (void *this, int *retVal)'), // 38
    get_CurrentOrientation: method('HRESULT __stdcall (void *this, int *retVal)'), // 39
    get_CurrentFrameworkId: method('HRESULT __stdcall (void *this, void **retVal)'), // 40
    get_CurrentIsRequiredForForm: method('HRESULT __stdcall (void *this, int *retVal)'), // 41
    get_CurrentItemStatus: method('HRESULT __stdcall (void *this, void **retVal)'), // 42
    get_CurrentBoundingRectangle: pointer(get_CurrentBoundingRectangleProto), // 43
});


// IUIAutomation Interface
export const IUIAutomationVtbl = struct('IUIAutomationVtbl', {
    // IUnknown
    QueryInterface: pointer(QueryInterfaceCallback),
    AddRef: pointer(AddRefCallback),
    Release: pointer(ReleaseCallback),

    // IUIAutomation
    CompareElements: method('HRESULT __stdcall (void *this, void *el1, void *el2, int *areSame)'), // 3
    CompareRuntimeIds: method('HRESULT __stdcall (void *this, void *runId1, void *runId2, int *areSame)'), // 4
    GetRootElement: pointer(GetRootElementProto), // 5
    GetRootElementBuildCache: method('HRESULT __stdcall (void *this, void *cacheRequest, void **root)'), // 6
    ElementFromHandle: method('HRESULT __stdcall (void *this, void *hwnd, void **element)'), // 7
    ElementFromPoint: method('HRESULT __stdcall (void *this, int64 pt, void **element)'), // 8
    ElementFromIAccessible: method('HRESULT __stdcall (void *this, void *accessible, int childId, void **element)'), // 9
    ElementFromIAccessibleBuildCache: method('HRESULT __stdcall (void *this, void *accessible, int childId, void *cacheRequest, void **element)'), // 10
    GetFocusedElement: method('HRESULT __stdcall (void *this, void **element)'), // 11
    GetFocusedElementBuildCache: method('HRESULT __stdcall (void *this, void *cacheRequest, void **element)'), // 12
    GetRootElementEx: method('HRESULT __stdcall (void *this, int traversalOptions, void **root)'), // 13
    CreateTreeWalker: method('HRESULT __stdcall (void *this, void *condition, void **walker)'), // 14
    get_ControlViewWalker: method('HRESULT __stdcall (void *this, void **walker)'), // 15
    get_ContentViewWalker: method('HRESULT __stdcall (void *this, void **walker)'), // 16
    get_RawViewWalker: method('HRESULT __stdcall (void *this, void **walker)'), // 17
    get_RawViewCondition: method('HRESULT __stdcall (void *this, void **condition)'), // 18
    get_ControlViewCondition: method('HRESULT __stdcall (void *this, void **condition)'), // 19
    get_ContentViewCondition: method('HRESULT __stdcall (void *this, void **condition)'), // 20
    CreateCacheRequest: method('HRESULT __stdcall (void *this, void **cacheRequest)'), // 21
    CreateTrueCondition: pointer(CreateTrueConditionProto), // 22
    CreateFalseCondition: method('HRESULT __stdcall (void *this, void **newCondition)'), // 23
    CreatePropertyCondition: pointer(CreatePropertyConditionProto), // 24
    CreatePropertyConditionEx: method('HRESULT __stdcall (void *this, int propertyId, VARIANT value, int flags, void **newCondition)'), // 25
    CreateAndCondition: method('HRESULT __stdcall (void *this, void *condition1, void *condition2, void **newCondition)'), // 26
    CreateAndConditionFromArray: method('HRESULT __stdcall (void *this, void *conditions, void **newCondition)'), // 27
    CreateAndConditionFromNativeArray: method('HRESULT __stdcall (void *this, void *conditions, int length, void **newCondition)'), // 28
    CreateOrCondition: method('HRESULT __stdcall (void *this, void *condition1, void *condition2, void **newCondition)'), // 29
    CreateOrConditionFromArray: method('HRESULT __stdcall (void *this, void *conditions, void **newCondition)'), // 30
    CreateOrConditionFromNativeArray: method('HRESULT __stdcall (void *this, void *conditions, int length, void **newCondition)'), // 31
    CreateNotCondition: method('HRESULT __stdcall (void *this, void *condition, void **newCondition)'), // 32
    AddAutomationEventHandler: method('HRESULT __stdcall (void *this, int eventId, void *element, int scope, void *cacheRequest, void *handler)'), // 33
    RemoveAutomationEventHandler: method('HRESULT __stdcall (void *this, int eventId, void *element, void *handler)'), // 34
});


// ... Property IDs ...
export const UIA_RuntimeIdPropertyId = 30000;
export const UIA_BoundingRectanglePropertyId = 30001;
export const UIA_ProcessIdPropertyId = 30002;
export const UIA_ControlTypePropertyId = 30003;
export const UIA_LocalizedControlTypePropertyId = 30004;
export const UIA_NamePropertyId = 30005;
export const UIA_AcceleratorKeyPropertyId = 30006;
export const UIA_AccessKeyPropertyId = 30007;
export const UIA_HasKeyboardFocusPropertyId = 30008;
export const UIA_IsKeyboardFocusablePropertyId = 30009;
export const UIA_IsEnabledPropertyId = 30010;
export const UIA_AutomationIdPropertyId = 30011;
export const UIA_ClassNamePropertyId = 30012;
export const UIA_HelpTextPropertyId = 30013;
export const UIA_ClickablePointPropertyId = 30014;
export const UIA_CulturePropertyId = 30015;
export const UIA_NativeWindowHandlePropertyId = 30020;
export const UIA_IsOffscreenPropertyId = 30022;
export const UIA_OrientationPropertyId = 30023;
export const UIA_FrameworkIdPropertyId = 30024;
export const UIA_IsContentElementPropertyId = 30027;
export const UIA_IsControlElementPropertyId = 30028;
export const UIA_IsPasswordPropertyId = 30019;
export const UIA_ItemTypePropertyId = 30021;
export const UIA_IsGridPatternAvailablePropertyId = 30045;

export const UIA_ButtonControlTypeId = 50000;
export const UIA_CalendarControlTypeId = 50001;
export const UIA_CheckBoxControlTypeId = 50002;
export const UIA_ComboBoxControlTypeId = 50003;
export const UIA_EditControlTypeId = 50004;
export const UIA_HyperlinkControlTypeId = 50005;
export const UIA_ImageControlTypeId = 50006;
export const UIA_ListItemControlTypeId = 50007;
export const UIA_ListControlTypeId = 50008;
export const UIA_MenuControlTypeId = 50009;
export const UIA_MenuBarControlTypeId = 50010;
export const UIA_MenuItemControlTypeId = 50011;
export const UIA_ProgressBarControlTypeId = 50012;
export const UIA_RadioButtonControlTypeId = 50013;
export const UIA_ScrollBarControlTypeId = 50014;
export const UIA_SliderControlTypeId = 50015;
export const UIA_SpinnerControlTypeId = 50016;
export const UIA_StatusBarControlTypeId = 50017;
export const UIA_TabControlTypeId = 50018;
export const UIA_TabItemControlTypeId = 50019;
export const UIA_TextControlTypeId = 50020;
export const UIA_ToolBarControlTypeId = 50021;
export const UIA_ToolTipControlTypeId = 50022;
export const UIA_TreeControlTypeId = 50023;
export const UIA_TreeItemControlTypeId = 50024;
export const UIA_CustomControlTypeId = 50025;
export const UIA_GroupControlTypeId = 50026;
export const UIA_ThumbControlTypeId = 50027;
export const UIA_DataGridControlTypeId = 50028;
export const UIA_DataItemControlTypeId = 50029;
export const UIA_DocumentControlTypeId = 50030;
export const UIA_SplitButtonControlTypeId = 50031;
export const UIA_WindowControlTypeId = 50032;
export const UIA_PaneControlTypeId = 50033;
export const UIA_HeaderControlTypeId = 50034;
export const UIA_HeaderItemControlTypeId = 50035;
export const UIA_TableControlTypeId = 50036;
export const UIA_TitleBarControlTypeId = 50037;
export const UIA_SeparatorControlTypeId = 50038;
export const UIA_SemanticZoomControlTypeId = 50039;
export const UIA_AppBarControlTypeId = 50040;

export const COINIT_MULTITHREADED = 0x0;
export const COINIT_APARTMENTTHREADED = 0x02;
export const CLSCTX_INPROC_SERVER = 0x1;

export const TreeScope = {
    Element: 0x1,
    Children: 0x2,
    Descendants: 0x4,
    Parent: 0x8,
    Ancestors: 0x10,
    Subtree: 0x7
};

export const CoInitializeEx = ole32.func('HRESULT __stdcall CoInitializeEx(void *pvReserved, uint32 dwCoInit)');
export const CoCreateInstance = ole32.func('HRESULT __stdcall CoCreateInstance(GUID *rclsid, void *pUnkOuter, uint32 dwClsContext, GUID *riid, void **ppv)');
export const VariantClear = oleaut32.func('HRESULT __stdcall VariantClear(void *pvarg)');
export const SysStringLen = oleaut32.func('uint32 __stdcall SysStringLen(void * bstr)');

export class UIAClient {
    private automation: any; // Pointer to IUIAutomation object

    constructor() {
        // Initialize COM
        CoInitializeEx(null, COINIT_APARTMENTTHREADED);

        // Explicitly allocate GUIDs for safety (Koffi stability)
        const clsidPtr = alloc(GUID, 1);
        encode(clsidPtr, GUID, CLSID_CUIAutomation);

        const iidPtr = alloc(GUID, 1);
        encode(iidPtr, GUID, IID_IUIAutomation);

        const ppvBuf = Buffer.alloc(8);
        const result = CoCreateInstance(clsidPtr, null, CLSCTX_INPROC_SERVER, iidPtr, ppvBuf);

        if (result < 0) {
            throw new Error(`CoCreateInstance failed: ${result}`);
        }

        this.automation = decode(ppvBuf, PVOID);
    }

    public getDesktopWindow(): any {
        try {
            const user32 = load('user32.dll');
            const GetDesktopWindow = user32.func('HWND __stdcall GetDesktopWindow()');
            return GetDesktopWindow();
        } catch {
            return null;
        }
    }

    public elementFromHandle(hwnd: any): UIAElement {
        const vtable = decode(decode(this.automation, PVOID), IUIAutomationVtbl);
        const func = decode(vtable.ElementFromHandle, proto('HRESULT __stdcall (void *this, void *hwnd, void **element)'));
        const buf = Buffer.alloc(8);
        const res = func(this.automation, hwnd, buf);
        if (res < 0) throw new Error(`ElementFromHandle failed: ${res}`);
        return new UIAElement(decode(buf, PVOID));
    }

    public getRootElement(): UIAElement {
        if (!this.automation) throw new Error('Automation object is null');

        const vptr = decode(this.automation, PVOID);
        const vtable = decode(vptr, IUIAutomationVtbl);
        const func = decode(vtable.GetRootElement, GetRootElementProto);

        const rootPtrBuf = Buffer.alloc(8);
        const res = func(this.automation, rootPtrBuf);

        if (res < 0) throw new Error(`GetRootElement failed: ${res}`);

        const rootPtr = decode(rootPtrBuf, PVOID);
        return new UIAElement(rootPtr);
    }

    public createTrueCondition(): any {
        const vptr = decode(this.automation, PVOID);
        const vtable = decode(vptr, IUIAutomationVtbl);
        const func = decode(vtable.CreateTrueCondition, CreateTrueConditionProto);

        const condPtrBuf = Buffer.alloc(8);
        const res = func(this.automation, condPtrBuf);
        if (res < 0) throw new Error(`CreateTrueCondition failed: ${res}`);

        return decode(condPtrBuf, PVOID);
    }

    // Temporarily disabled due to hard crashes with VARIANT pass-by-value on some environments.
    // We use JS-based filtering in the engine instead.
    public createPropertyCondition(propertyId: number, value: any): any {
        throw new Error("Native CreatePropertyCondition is currently disabled for stability");
    }

    public getRawViewCondition(): any {
        const vtable = decode(decode(this.automation, PVOID), IUIAutomationVtbl);
        const func = decode(vtable.get_RawViewCondition, proto('HRESULT __stdcall (void *this, void **condition)'));
        const buf = Buffer.alloc(8);
        const res = func(this.automation, buf);
        if (res < 0) throw new Error(`get_RawViewCondition failed: ${res}`);
        return decode(buf, PVOID);
    }

    public createAndCondition(c1: any, c2: any): any {
        const vtable = decode(decode(this.automation, PVOID), IUIAutomationVtbl);
        const func = decode(vtable.CreateAndCondition, proto('HRESULT __stdcall (void *this, void *c1, void *c2, void **res)'));
        const buf = Buffer.alloc(8);
        const res = func(this.automation, c1, c2, buf);
        if (res < 0) throw new Error(`CreateAndCondition failed: ${res}`);
        return decode(buf, PVOID);
    }

    public createOrCondition(c1: any, c2: any): any {
        const vtable = decode(decode(this.automation, PVOID), IUIAutomationVtbl);
        const func = decode(vtable.CreateOrCondition, proto('HRESULT __stdcall (void *this, void *c1, void *c2, void **res)'));
        const buf = Buffer.alloc(8);
        const res = func(this.automation, c1, c2, buf);
        if (res < 0) throw new Error(`CreateOrCondition failed: ${res}`);
        return decode(buf, PVOID);
    }

    public createNotCondition(c: any): any {
        const vtable = decode(decode(this.automation, PVOID), IUIAutomationVtbl);
        const func = decode(vtable.CreateNotCondition, proto('HRESULT __stdcall (void *this, void *c, void **res)'));
        const buf = Buffer.alloc(8);
        const res = func(this.automation, c, buf);
        if (res < 0) throw new Error(`CreateNotCondition failed: ${res}`);
        return decode(buf, PVOID);
    }
}

// IUIAutomationElementArray Interface
export const IUIAutomationElementArrayVtbl = struct('IUIAutomationElementArrayVtbl', {
    // IUnknown
    QueryInterface: pointer(QueryInterfaceCallback),
    AddRef: pointer(AddRefCallback),
    Release: pointer(ReleaseCallback),

    // IUIAutomationElementArray
    get_Length: pointer(proto('HRESULT __stdcall (void *this, int *length)')),
    GetElement: pointer(proto('HRESULT __stdcall (void *this, int index, void **element)')),
});

export class UIAElement {
    private element: any; // Pointer to IUIAutomationElement

    constructor(ptr: any) {
        this.element = ptr;
    }

    private getVTable() {
        const vptr = decode(this.element, PVOID);
        return decode(vptr, IUIAutomationElementVtbl);
    }

    public setFocus(): void {
        const vtable = this.getVTable();
        const func = decode(vtable.SetFocus, proto('HRESULT __stdcall (void *this)'));
        const res = func(this.element);
        if (res < 0) throw new Error(`SetFocus failed: ${res}`);
    }

    public getBoundingRectangle(): { left: number, top: number, right: number, bottom: number } {
        const vtable = this.getVTable();
        const func = decode(vtable.get_CurrentBoundingRectangle, get_CurrentBoundingRectangleProto);

        const rectBuf = Buffer.alloc(16); // 4 * 4 bytes
        const res = func(this.element, rectBuf);
        if (res < 0) throw new Error(`get_CurrentBoundingRectangle failed: ${res}`);

        const rect = decode(rectBuf, RECT);
        return rect;
    }

    public probe(index: number): string {
        const vptr = decode(this.element, PVOID);
        const ptrArray = decode(vptr, 'void*[100]');
        const funcPtr = ptrArray[index];

        if (!funcPtr) return "NULL";

        const func = decode(funcPtr, proto('HRESULT __stdcall (void *this, void *retVal)'));

        const buf = Buffer.alloc(16);
        try {
            const res = func(this.element, buf);
            if (res < 0) return `Error:${res}`;

            const bstrPtr = decode(buf.subarray(0, 8), PVOID);
            if (!bstrPtr) return "EmptyPtr";

            // Safety Check: if pointer is low value (likely int), don't treat as address
            const addr = address(bstrPtr);
            if (addr < 65536) return `Int:${addr}`;

            try {
                const len = SysStringLen(bstrPtr);
                if (len > 0 && len < 1000) {
                    const bytes = decode(bstrPtr, 'uint8', len * 2);
                    const str = Buffer.from(bytes).toString('utf16le');
                    if (/^[\\w\\s\\.]+$/.test(str) || str.includes("Taskbar")) {
                        return `STR:${str}`;
                    }
                    return `PossibleStr:${str.substring(0, 20)}`;
                }
                return `Len:${len}`;
            } catch {
                return "NotString";
            }
        } catch (e) {
            return "Crash";
        }
    }

    public getName(): string {
        const vtable = this.getVTable();
        // Index 23
        const func = decode(vtable.get_CurrentName, proto('HRESULT __stdcall (void *this, void **retVal)'));

        const ptrBuf = Buffer.alloc(8);
        const res = func(this.element, ptrBuf);
        if (res < 0) throw new Error(`get_CurrentName failed: ${res}`);

        const bstrPtr = decode(ptrBuf, PVOID);
        if (!bstrPtr) return "";

        try {
            const len = SysStringLen(bstrPtr);
            if (len > 0) {
                const bytes = decode(bstrPtr, 'uint8', len * 2);
                return Buffer.from(bytes).toString('utf16le');
            }
        } finally {
            SysFreeString(bstrPtr);
        }
        return "";
    }

    public getClassName(): string {
        const vtable = this.getVTable();
        // Index 30
        const func = decode(vtable.get_CurrentClassName, proto('HRESULT __stdcall (void *this, void **retVal)'));

        const ptrBuf = Buffer.alloc(8);
        const res = func(this.element, ptrBuf);
        if (res < 0) throw new Error(`get_CurrentClassName failed: ${res}`);

        const bstrPtr = decode(ptrBuf, PVOID);
        if (!bstrPtr) return "";

        try {
            const len = SysStringLen(bstrPtr);
            if (len > 0) {
                const bytes = decode(bstrPtr, 'uint8', len * 2);
                return Buffer.from(bytes).toString('utf16le');
            }
        } finally {
            SysFreeString(bstrPtr);
        }
        return "";
    }

    public findFirst(scope: number, conditionPtr: any): UIAElement | null {
        const vtable = this.getVTable();
        const func = decode(vtable.FindFirst, FindFirstProto);

        const foundPtr = Buffer.alloc(8);
        const res = func(this.element, scope, conditionPtr, foundPtr);

        if (res < 0) throw new Error(`FindFirst failed: ${res}`);

        const ptr = decode(foundPtr, PVOID);
        if (!ptr) return null;

        return new UIAElement(ptr);
    }

    public findAll(scope: number, conditionPtr: any): UIAElementArray | null {
        const vtable = this.getVTable();
        const func = decode(vtable.FindAll, FindAllProto);

        const foundPtr = Buffer.alloc(8);
        const res = func(this.element, scope, conditionPtr, foundPtr);

        if (res < 0) throw new Error(`FindAll failed: ${res}`);

        const ptr = decode(foundPtr, PVOID);
        if (!ptr) return null;

        return new UIAElementArray(ptr);
    }

    public getCurrentPropertyValue(propertyId: number): any {
        const vtable = this.getVTable();
        const func = decode(vtable.GetCurrentPropertyValue, GetCurrentPropertyValueProto);

        const variantBuf = Buffer.alloc(24);
        const res = func(this.element, propertyId, variantBuf);

        if (res < 0) throw new Error(`GetCurrentPropertyValue failed: ${res}`);

        const vt = variantBuf.readUInt16LE(0);
        let value: any = null;

        try {
            switch (vt) {
                case VT_I4:
                    value = variantBuf.readInt32LE(8);
                    break;
                case VT_BOOL:
                    value = variantBuf.readInt16LE(8) !== 0;
                    break;
                case VT_BSTR:
                    const bstrPtr = decode(variantBuf.subarray(8, 16), PVOID);
                    if (bstrPtr) {
                        try {
                            const len = SysStringLen(bstrPtr);
                            if (len > 0) {
                                const bytes = decode(bstrPtr, 'uint8', len * 2);
                                value = Buffer.from(bytes).toString('utf16le');
                            } else {
                                value = "";
                            }
                        } catch (e) {
                            console.error('Error decoding BSTR:', e);
                        }
                    } else {
                        value = "";
                    }
                    break;
                case 0x2003: // VT_ARRAY | VT_I4
                    const safeArrayPtr = decode(variantBuf.subarray(8, 16), PVOID);
                    if (safeArrayPtr) {
                        try {
                            const SafeArrayGetVartype = oleaut32.func('HRESULT __stdcall SafeArrayGetVartype(void *, uint16 *)');
                            const SafeArrayGetLBound = oleaut32.func('HRESULT __stdcall SafeArrayGetLBound(void *, uint, long *)');
                            const SafeArrayGetUBound = oleaut32.func('HRESULT __stdcall SafeArrayGetUBound(void *, uint, long *)');
                            const SafeArrayAccessData = oleaut32.func('HRESULT __stdcall SafeArrayAccessData(void *, void **)');
                            const SafeArrayUnaccessData = oleaut32.func('HRESULT __stdcall SafeArrayUnaccessData(void *)');

                            let lboundBuf = Buffer.alloc(4);
                            let uboundBuf = Buffer.alloc(4);
                            SafeArrayGetLBound(safeArrayPtr, 1, lboundBuf);
                            SafeArrayGetUBound(safeArrayPtr, 1, uboundBuf);
                            const lbound = lboundBuf.readInt32LE(0);
                            const ubound = uboundBuf.readInt32LE(0);
                            const count = ubound - lbound + 1;

                            if (count > 0) {
                                let dataPtrBuf = Buffer.alloc(8);
                                SafeArrayAccessData(safeArrayPtr, dataPtrBuf);
                                const dataPtr = decode(dataPtrBuf, PVOID);
                                const ints = decode(dataPtr, 'int32', count);
                                value = Array.from(ints);
                                SafeArrayUnaccessData(safeArrayPtr);
                            } else {
                                value = [];
                            }
                        } catch (e) {
                            console.error('Error decoding SafeArray:', e);
                            value = [];
                        }
                    } else {
                        value = [];
                    }
                    break;
                case 0: // VT_EMPTY
                    value = null;
                    break;
                default:
                    console.warn(`Unsupported VARIANT type: ${vt}`);
                    value = null;
            }
        } catch (e) {
            console.error('Error parsing variant:', e);
        } finally {
            const hr = VariantClear(variantBuf);
            if (hr < 0) console.error(`VariantClear failed: ${hr}`);
        }

        return value;
    }

    // JS-side fallback for finding elements by property since CreatePropertyCondition crashes.
    public findFirstByProperty(scope: number, propertyId: number, value: any, client: UIAClient): UIAElement | null {
        // Only TreeScope.Children is efficiently supported by this fallback for now.
        // Descendants would require recursive traversal.

        // Use CreateTrueCondition to get all items
        const trueCond = client.createTrueCondition();
        const children = this.findAll(scope, trueCond);

        if (!children) return null;

        const count = children.length;
        for (let i = 0; i < count; i++) {
            // Access element directly without creating full JS wrapper logic overhead if possible?
            // children.getElement(i) returns UIAElement.
            const el = children.getElement(i);
            try {
                const propVal = el.getCurrentPropertyValue(propertyId);
                // Simple equality check
                if (propVal === value) {
                    return el;
                }
            } catch (e) {
                // Ignore error reading property
            }
        }
        return null;
    }

    public findAllByProperty(scope: number, propertyId: number, value: any, client: UIAClient): UIAElement[] {
        const result: UIAElement[] = [];
        let cond: any;
        try {
            cond = client.createPropertyCondition(propertyId, value);
        } catch (e) {
            // Fallback to JS filtering if native condition creation fails
            const trueCond = client.createTrueCondition();
            const children = this.findAll(scope, trueCond);
            if (!children) return result;
            for (const el of children.toArray()) {
                if (el.getCurrentPropertyValue(propertyId) === value) result.push(el);
            }
            return result;
        }

        const array = this.findAll(scope, cond);
        return array ? array.toArray() : [];
    }
}

export class UIAElementArray {
    private array: any;
    constructor(ptr: any) { this.array = ptr; }

    public get length(): number {
        const vptr = decode(this.array, PVOID);
        const vtable = decode(vptr, IUIAutomationElementArrayVtbl);
        const func = decode(vtable.get_Length, get_LengthProto);

        const lenBuf = Buffer.alloc(4);
        const res = func(this.array, lenBuf);
        if (res < 0) throw new Error(`get_Length failed: ${res}`);

        return decode(lenBuf, 'int');
    }

    public getElement(index: number): UIAElement {
        const vptr = decode(this.array, PVOID);
        const vtable = decode(vptr, IUIAutomationElementArrayVtbl);
        const func = decode(vtable.GetElement, GetElementProto);

        const elPtrBuf = Buffer.alloc(8);
        const res = func(this.array, index, elPtrBuf);
        if (res < 0) throw new Error(`GetElement failed: ${res}`);

        const ptr = decode(elPtrBuf, PVOID);
        return new UIAElement(ptr);
    }

    public toArray(): UIAElement[] {
        const len = this.length;
        const result: UIAElement[] = [];
        for (let i = 0; i < len; i++) result.push(this.getElement(i));
        return result;
    }
}
