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
        console.log("--- PoC: COM UIA Access ---");

        // Find target element first to get its RuntimeId from the Managed world
        // ComboBox "Recipients:" has AutoId 3033
        const el = await driver.$("//ComboBox[@AutomationId='3033']");
        const runtimeIdStr = await el.getAttribute("RuntimeId"); // e.g., "42.12345"
        console.log("Target RuntimeId:", runtimeIdStr);

        const script = `
            $runtimeIdStr = "${runtimeIdStr}";
            $runtimeId = $runtimeIdStr.Split('.') | ForEach-Object { [int]$_ };
            
            Write-Output "Attempting to create CUIAutomation COM object...";
            try {
                $uia = New-Object -ComObject "UIAutomationCore.CUIAutomation"
                # If ProgID fails, try CLSID: {ff48dba4-60ef-4201-aa87-54103eef594e}
            } catch {
                Write-Output "Failed with ProgID. Trying CLSID..."
                $uia = New-Object -ComObject "{ff48dba4-60ef-4201-aa87-54103eef594e}"
            }

            if ($null -eq $uia) {
                Write-Output "FATAL: Could not create CUIAutomation object.";
            } else {
                Write-Output "SUCCESS: CUIAutomation created.";
                
                # Convert runtime ID to SAFEARRAY (PowerShell might wrap it essentially)
                # ElementFromRuntimeId expects a SafeArray of ints.
                # In PS, passing an [int[]] usually works for COM dispatch.
                
                try {
                    $comElement = $uia.ElementFromRuntimeId($runtimeId);
                    
                    if ($comElement) {
                        Write-Output "FOUND COM Element!";
                        # UIA_LegacyIAccessiblePatternId = 10018
                        # GetCurrentPattern returns IUnknown, we might need to cast or just use it if PS adapts it.
                        
                        $pattern = $comElement.GetCurrentPattern(10018);
                        if ($pattern) {
                             Write-Output "GOT Legacy Pattern Object!";
                             # Access properties directly?
                             # In COM, it's get_CurrentName(), get_CurrentValue(), etc.
                             # Or just .CurrentName if PS adapts it.
                             # Actually, IUIAutomationLegacyIAccessiblePattern properties:
                             # CurrentValue, CurrentName, etc.
                             
                             try {
                                 Write-Output "Legacy Value: $($pattern.CurrentValue)";
                                 Write-Output "Legacy Name: $($pattern.CurrentName)";
                                 Write-Output "Legacy Role: $($pattern.CurrentRole)";
                             } catch {
                                 Write-Output "Error accessing properties on pattern: $($_.Exception.Message)";
                                  # Try get_CurrentValue
                                 Write-Output "Legacy Value (method): $($pattern.CurrentValue)";
                             }
                             
                        } else {
                            Write-Output "GetCurrentPattern(10018) returned null.";
                        }
                    } else {
                        Write-Output "ElementFromRuntimeId returned null.";
                    }
                } catch {
                    Write-Output "Error using COM object: $($_.Exception.Message)";
                    Write-Output "Full: $($_.Exception)";
                }
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
