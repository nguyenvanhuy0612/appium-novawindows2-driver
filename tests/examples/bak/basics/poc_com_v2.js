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
        console.log("--- PoC: COM v2 & HWND ---");
        const el = await driver.$("//ComboBox[@AutomationId='3033']");
        const hwnd = await el.getAttribute("NativeWindowHandle");
        console.log("Target HWND:", hwnd);

        const runtimeIdStr = await el.getAttribute("RuntimeId");
        console.log("Target RuntimeId:", runtimeIdStr);

        const script = `
            # 1. Try alternate CLSIDs for CUIAutomation
            $clsids = @(
                "{ff48dba4-60ef-4201-aa87-54103eef594e}", # CUIAutomation (Default)
                "{e22ad333-b25f-460c-83d0-0581107395c9}"  # CUIAutomation8 (Win8+)
            );
            
            $comSuccess = $false;
            foreach ($clsid in $clsids) {
                try {
                    Write-Output "Trying CLSID $clsid ...";
                    $uia = New-Object -ComObject $clsid;
                    if ($null -ne $uia) {
                        Write-Output "SUCCESS: Created object for $clsid";
                        $comSuccess = $true;
                        
                        # Try getting element
                        $runtimeIdStr = "${runtimeIdStr}";
                        $runtimeId = $runtimeIdStr.Split('.') | ForEach-Object { [int]$_ };
                        $comElement = $uia.ElementFromRuntimeId($runtimeId);
                        if ($comElement) {
                             Write-Output "Got COM Element. Checking Legacy Pattern...";
                             try {
                                 # 10018 = LegacyIAccessiblePattern
                                 $p = $comElement.GetCurrentPattern(10018);
                                 if ($p) {
                                     Write-Output "Legacy Value: $($p.CurrentValue)";
                                 } else {
                                     Write-Output "Legacy Pattern not found via COM.";
                                 }
                             } catch {
                                 Write-Output "Error reading pattern: $($_.Exception.Message)";
                             }
                        }
                        break; 
                    }
                } catch {
                    Write-Output "Failed: $($_.Exception.Message)";
                }
            }

            if (-not $comSuccess) {
                Write-Output "ALL COM ATTEMPTS FAILED.";
            }

            # 2. Check simple MSAA availability
            Write-Output "--- MSAA Feasibility ---";
            $h = ${hwnd};
            if ($h -gt 0) {
                 Write-Output "HWND $h is valid. MSAA (AccessibleObjectFromWindow) IS feasible.";
            } else {
                 Write-Output "HWND is 0. MSAA requires parent navigation.";
            }
        `;

        const output = await driver.executeScript('powerShell', [{ command: script }]);
        console.log(output);

    } catch (error) {
        console.error("PoC Failed:", error);
    } finally {
        await driver.deleteSession();
    }
}

main();
