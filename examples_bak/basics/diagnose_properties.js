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
        console.log("--- Diagnosing Legacy Property IDs (Fixed Syntax) ---");
        const script = `
            # Explicitly checking IDs one by one to avoid loop/hash table complexity in this debug
            
            # 1. Pattern 10018 (LegacyIAccessiblePattern)
            try {
                $p = [System.Windows.Automation.AutomationPattern]::LookupById(10018);
                if ($null -ne $p) {
                    Write-Output ("FOUND Pattern 10018: {0}" -f $p.ProgrammaticName);
                } else {
                    Write-Output "NOT FOUND Pattern 10018 (LegacyIAccessiblePattern)";
                }
            } catch {
                Write-Output ("Error checking Pattern 10018: {0}" -f $_.Exception.Message);
            }

            # 2. Property 30093 (Value)
            try {
                $prop = [System.Windows.Automation.AutomationProperty]::LookupById(30093);
                if ($null -ne $prop) {
                    Write-Output ("FOUND Property 30093: {0}" -f $prop.ProgrammaticName);
                } else {
                    Write-Output "NOT FOUND Property 30093 (LegacyValue)";
                }
            } catch {
                Write-Output ("Error checking Property 30093: {0}" -f $_.Exception.Message);
            }
            
            # 3. Property 30092 (Name)
            try {
                $prop = [System.Windows.Automation.AutomationProperty]::LookupById(30092);
                if ($null -ne $prop) {
                    Write-Output ("FOUND Property 30092: {0}" -f $prop.ProgrammaticName);
                } else {
                    Write-Output "NOT FOUND Property 30092 (LegacyName)";
                }
            } catch {
                 Write-Output ("Error checking Property 30092: {0}" -f $_.Exception.Message);
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
