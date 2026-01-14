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
        console.log("--- Debugging LegacyIAccessible ---");

        // Find the specific ComboBox by AutomationId
        // The user logs showed AutomationId="3033" for the ComboBox "Recipients:"
        const element = await driver.$("//ComboBox[@AutomationId='3033']"); // Using specific ID for precision

        if (!element.error) {
            console.log("Element found:", element.elementId);

            // 1. Check IsLegacyIAccessiblePatternAvailable via attribute (repro failure)
            const isAvailable = await element.getAttribute('IsLegacyIAccessiblePatternAvailable');
            console.log(`getAttribute('IsLegacyIAccessiblePatternAvailable'): ${isAvailable}`);

            const val = await element.getAttribute('LegacyValue');
            console.log(`getAttribute('LegacyValue'): '${val}'`);

            // 2. Run raw PowerShell to debug
            // We access the element from the $elementTable using its ID
            const script = `
                $el = $elementTable['${element.elementId}'];
                if ($null -eq $el) {
                    Write-Output "Element not found in table with ID: ${element.elementId}";
                } else {
                    Write-Output "Element class: $($el.Current.ClassName)";
                    
                    try {
                        $pattern = $el.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern);
                        if ($null -ne $pattern) {
                            Write-Output "Legacy Pattern FOUND.";
                            Write-Output "Legacy Value: $($pattern.Current.Value)";
                            Write-Output "Legacy Role: $($pattern.Current.Role)";
                        } else {
                            Write-Output "Legacy Pattern returned NULL.";
                        }
                    } catch {
                        Write-Output "ERROR getting legacy pattern: $($_.Exception.Message)";
                        Write-Output "Full Error: $($_.Exception)";
                    }

                    # Check supported patterns
                    try {
                        $patterns = $el.GetSupportedPatterns();
                        Write-Output "Supported Patterns: $($patterns | ForEach-Object { $_.ProgrammaticName })";
                    } catch {
                        Write-Output "Error getting supported patterns: $($_.Exception.Message)";
                    }
                }
            `;

            const output = await driver.executeScript('powerShell', [{ command: script }]);
            console.log("--- PowerShell Debug Output ---");
            console.log(output);
            console.log("-------------------------------");

        } else {
            console.log("Element '3033' not found. Trying generic search...");
            // Fallback to name if ID fails
            const el2 = await driver.$("//ComboBox[contains(@Name, 'Recipients')]");
            if (!el2.error) {
                console.log("Found by Name. ID:", el2.elementId);
                // ... (could repeat logic, but let's assume one is found)
            } else {
                console.log("Could not find element to debug.");
            }
        }

    } catch (error) {
        console.error("Debug Script Failed:", error);
    } finally {
        await driver.deleteSession();
    }
}

main();
