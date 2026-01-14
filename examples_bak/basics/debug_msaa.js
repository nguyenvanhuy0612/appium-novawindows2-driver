const { remote } = require('webdriverio');

async function main() {
    const opts = {
        hostname: '172.16.1.52',
        port: 4723,
        path: '/',
        capabilities: {
            "appium:automationName": "NovaWindows2",
            "platformName": "Windows",
            "appium:app": "Root",
        },
        logLevel: 'error'
    };
    const driver = await remote(opts);
    try {
        console.log("--- Testing MSAA P/Invoke (Reflection) ---");
        const el = await driver.$("//ComboBox[@AutomationId='3033']");
        const hwnd = await el.getAttribute("NativeWindowHandle");
        console.log("Target HWND:", hwnd);

        const script = `
            $hwnd = ${hwnd};
            
            $code = @"
            using System;
            using System.Runtime.InteropServices;
            using System.Reflection;
            
            public static class MSAAHelper {
                [DllImport("oleacc.dll")]
                private static extern int AccessibleObjectFromWindow(IntPtr hwnd, uint dwId, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppvObject);

                public static string GetValue(IntPtr hwnd) {
                   Guid IID_IAccessible = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
                   object acc = null;
                   // OBJID_CLIENT = 0xFFFFFFFC (-4)
                   int res = AccessibleObjectFromWindow(hwnd, 0xFFFFFFFC, ref IID_IAccessible, out acc);
                   if (res == 0 && acc != null) {
                       try {
                           // Use Reflection to avoid 'dynamic' dependency
                           // acc.accValue(0) -> Property get
                           
                           // Note: AccessibleObjectFromWindow returns an IDispatch/IAccessible object.
                           // We can use IDispatch if strict interface fails, but let's try strict reflection on the RCW.
                           
                           object result = acc.GetType().InvokeMember("accValue", 
                               BindingFlags.GetProperty, 
                               null, 
                               acc, 
                               new object[] { 0 }); // 0 = CHILDID_SELF
                               
                           return result as string;
                       } catch (Exception e) {
                           return "Error: " + e.Message;
                       }
                   }
                   return "Failed to get object or result non-zero: " + res;
                }
            }
"@
            Add-Type -TypeDefinition $code -Language CSharp
            
            [MSAAHelper]::GetValue([IntPtr]${hwnd})
        `;

        const output = await driver.executeScript('powerShell', [{ command: script }]);
        console.log("MSAA Output:", output);

    } catch (error) {
        console.error("Debug Script Failed:", error);
    } finally {
        await driver.deleteSession();
    }
}

main();
