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
        console.log("--- Diagnosing Types & Pattern ID ---");
        const script = `
            # 1. Search for any type containing 'Legacy' in loaded assemblies
            $assemblies = [AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.FullName -like "*UIAutomation*" };
            foreach ($asm in $assemblies) {
               $types = $asm.GetTypes() | Where-Object { $_.Name -like "*Legacy*" };
               if ($types) {
                   Write-Output "In $($asm.GetName().Name):";
                   $types | ForEach-Object { Write-Output "  - $($_.FullName)" }
               }
            }

            # 2. Try LookupById
            # UIA_LegacyIAccessiblePatternId = 10018
            try {
                $legacyPatternId = 10018;
                $p = [System.Windows.Automation.AutomationPattern]::LookupById($legacyPatternId);
                if ($null -ne $p) {
                    Write-Output "Pattern LookupById(10018) SUCCESS: $($p.ProgrammaticName)";
                } else {
                    Write-Output "Pattern LookupById(10018) returned NULL.";
                }
            } catch {
                Write-Output "Error looking up pattern by ID: $($_.Exception.Message)";
            }
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
