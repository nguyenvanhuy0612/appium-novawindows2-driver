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
        console.log("--- Diagnosing Assemblies ---");
        const script = `
            $assemblies = [AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.FullName -like "*UIAutomation*" };
            foreach ($asm in $assemblies) {
                Write-Output "Assembly: $($asm.FullName)";
                Write-Output "Location: $($asm.Location)";
                
                try {
                    $type = $asm.GetType("System.Windows.Automation.LegacyIAccessiblePattern");
                    if ($null -ne $type) {
                        Write-Output "  -> FOUND LegacyIAccessiblePattern in this assembly!";
                    } else {
                        Write-Output "  -> LegacyIAccessiblePattern NOT found in this assembly.";
                    }
                } catch {
                     Write-Output "  -> Error checking type: $($_.Exception.Message)";
                }
            }

            Write-Output "--- Explicit Type Lookup ---";
            $t = [System.Type]::GetType("System.Windows.Automation.LegacyIAccessiblePattern, UIAutomationClient, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35");
            if ($null -ne $t) { Write-Output "Found via explicit string: $($t.FullName)" } else { Write-Output "Not found via explicit string." }
        `;

        const output = await driver.executeScript('powerShell', [{ command: script }]);
        console.log(output);

    } catch (error) {
        console.error("Diagnosis Failed:", error);
    } finally {
        await driver.deleteSession();
    }
}

main();
