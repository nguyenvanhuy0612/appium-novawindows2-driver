import { xpathToElIdOrIds } from '../lib/xpath/core';

async function main() {
    // This selector uses 'contains', which is a function call.
    // processExprNodeAsPredicate will handle this safely if correct, 
    // but the bug causes it to fall through to RELATIVE_LOCATION_PATH 
    // and crash because it treats a FunctionCallNode as a LocationNode.
    const selectors = [
        // Basic & Wildcards
        "//Window",
        "/*",
        "//*",
        "//*//*",
        "//Window/*",
        "//Window[contains(@*, 'name')]",

        // Attributes & Logic
        "//Window[@Name='name']",
        "//Window[@Name='name' and @Type='button']",
        "//Window[@Name='name' or @Type='button']",
        "//Window[not(@Enabled)]",
        "//Window[@Name='a'][@Type='b']", // Chained predicates

        // Indexing & Grouping
        "//Window[1]",
        "//Window[last()]",
        "//Window[position()=1]",
        "//Window[position()>2]",
        "(//Button)[2]",
        "(/Button)[1]",

        // Functions
        "//Window[contains(@Name, 'something')]",
        "//Window[starts-with(@Name, 'start')]",
        "//Window[string-length(@Name) > 5]",
        "//Window[boolean(@Focused)]",
        "//Window[not(contains(@Name, 'foo'))]",

        // Axes
        "//Window/child::*",
        "//Window/descendant::*",
        "//Window/parent::*",
        "//Window/following-sibling::*",
        "//Window/preceding-sibling::*",
        "//Window/following::*",
        "//Window/preceding::*",
        "//Window/self::*",
        "//Window/ancestor::*",
        "//Window/ancestor-or-self::*",

        // Math & Complex
        "//Window[@width + @height > 100]",
        "//Window[@x * 2 = @y]",
        "//Window[@price div 2 < 10]",
        "//Window[@count mod 2 = 0]",

        // Specific user requests & variations
        "//Window[@Name='name'][1]",
        "//List/item[3]",
        "//Window[starts-with(@Name, 'a') and contains(@Name, 'b')]",
        "//Window[not(position()=1)]",
        "//*[@Name='foo']",
        "//*[count(.//item) > 3]", // Note: count() might not be supported but worth testing dispatch
        "//Window/..",

        // Literal matches
        "//Window[text()='some text']", // if text() is supported
        "//Window[.='some text']",

        // Nested predicates
        "//Window[child::Button[contains(@id, '1')]]",

        // Real-world examples from secureage-windows/keywords
        "//Window[starts-with(@Name, 'SecureAge Profile')]//List/ListItem", // nested starts-with
        "//Window[@Name='SecureAge' and ./Text[contains(@Name,'Password')]]//Edit[1]", // nested predicate with contains
        "//Window[@Name='SecureAge' and ./Text[contains(@Name,'cancel the certificate creation')]]/Button[@Name='Yes']",
        "//Window[@Name='SecureAge']/Button[@Name='OK' or @Name='Ok']", // OR in predicate
        "//Window/Text[6]", // direct index on child
        "//Window[starts-with(@Name,'SecureAge')]//*[@Name='Header Control']/*", // Wildcard child
        "//List/ListItem[3]/Text", // Template placeholder (should parse fine)
        "//Window[@Name='SecureAge New Password']/Edit[1]",
        "//Window/Window//Button[@Name='Close']", // Double slash inside path
        "//ProgressBar/ToolBar/Button[@Name='Previous Locations']", // Deep nesting
        "//List[./Header]", // Predicate checking for child existence
        "//Header[@Name='Header Control']/ancestor::Pane/List[1]", // Ancestor axis
        "//Window[@Name='SecureFile - Configuration']/List/ListItem[@Name='name']/Text[1]",
    ];

    // Mock sendPowerShellCommand
    const sendPowerShellCommand = async (cmd: string) => {
        // Return dummy response that mimics finding nothing or something, 
        // strictly to get past the initial search if needed.
        // But for processExprNodeAsPredicate failure, the crash likely happens during AST processing logic
        // or during filtering.
        // Actually, core.ts executes the search.
        // We just need to ensure it doesn't crash immediately.
        return "";
    };

    let failureCount = 0;
    for (const sel of selectors) {
        console.log(`Testing selector: ${sel}`);
        try {
            await xpathToElIdOrIds(sel, true, undefined, sendPowerShellCommand);
            console.log(`  -> OK`);
        } catch (e: any) {
            console.error(`  -> FAILED: ${e.message}`);
            if (e instanceof TypeError && e.message.includes("Cannot read properties of undefined (reading 'length')")) {
                console.log(`     (Confirmed Bug)`);
                failureCount++;
            } else {
                // Some might fail for other reasons if the mock isn't sufficient, but we mainly care about the TypeError
                console.log(`     (Other Error: ${e.message})`);
            }
        }
    }

    if (failureCount > 0) {
        console.log(`\nReproduced bug in ${failureCount} cases.`);
        process.exit(0);
    } else {
        console.log("\nNo bugs reproduced.");
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
