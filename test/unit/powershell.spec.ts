
import { expect } from 'chai';
import {
    AutomationElement,
    PropertyCondition,
    Property,
    PSString,
    TreeScope,
    FoundAutomationElement
} from '../../lib/powershell';

// Helper to recursively decode the PowerShell command
function decodeCommand(cmd: string): string {
    const base64Regex = /FromBase64String\('(.+?)'\)/;
    const match = cmd.match(base64Regex);
    if (match && match[1]) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
        // If the decoded string itself contains another encoding layer, recurse
        if (decoded.includes('Invoke-Expression')) {
            // We might have multiple nested commands.
            // But usually the structure is: (Invoke... (Invoke...))
            // We want to unwrap fully.
            return decodeCommand(decoded);
        }
        return decoded;
    }
    return cmd;
}

// Since the command structure allows mixed raw and encoded parts (via string interpolation),
// simplest way to verify is to check if the *decoded* container contains the *decoded* inner parts.
// Actually, inspecting `lib/powershell/core.ts` shows that `pwsh$` wraps the entire result of formatting.
// So `cmd` is 100% wrapped.

describe('PowerShell Generation', () => {
    it('should generate correct FindFirst command with name condition', () => {
        const root = AutomationElement.automationRoot;
        const condition = new PropertyCondition(Property.NAME, new PSString('Calculator'));

        // This returns the command to SAVE result
        const command = root.findFirst(TreeScope.DESCENDANTS, condition).buildCommand();
        const decoded = decodeCommand(command);
        console.log('DEBUG FindFirst:', decoded);

        // Expect the Search Loop and Condition
        expect(decoded).to.contain('Find-ChildrenRecursively');
        // Actually, looking at elements.ts `FIND_DESCENDANTS` uses `Find-ChildrenRecursively`

        // Wait, AutomationRoot is simpler. 
        // Let's check finding from Root.
        // AutomationRoot uses AUTOMATION_ROOT = `$rootElement`
        // findFirst uses `FIND_DESCENDANTS.format(this, condition)`

        // The decoded string should contain the script block logic
        expect(decoded).to.contain('Find-ChildrenRecursively');
        expect(decoded).to.contain('[AutomationElement]::nameProperty');
    });

    it('should generate correct FindAll command', () => {
        const root = AutomationElement.automationRoot;
        const condition = new PropertyCondition(Property.CLASS_NAME, new PSString('Button'));
        const command = root.findAll(TreeScope.CHILDREN, condition).buildCommand();
        const decoded = decodeCommand(command);

        expect(decoded).to.contain('.FindAll([TreeScope]::');
        // Actually scope CHILDREN matches FIND_ALL_CHILDREN_OR_SELF.format... no wait
        // switch(scope) case CHILDREN: -> FIND_ALL.format(this, scope, condition)
        // FIND_ALL = `${0}.FindAll([TreeScope]::${1}, ${2})`;

        // So for Children, it goes to default case if not explicitly defined in switch?
        // Let's check switch in elements.ts...
        // case TreeScope.CHILDREN: does NOT exist in findFirst/findAll switch?
        // Ah, it does exist now or I missed it?
        // lines 565: CHILDREN: 'children'
        // switch (scope) ... case TreeScope.CHILDREN: matches line 643? No line 643 is CHILDREN_OR_SELF.
        // It seems TreeScope.CHILDREN falls through to default: `return new AutomationElement(FIND_ALL.format(this, scope, condition));`

        // So expected output: `$rootElement.FindAll([TreeScope]::children, ...)`
        // But 'children' is lowercase string from Enum. The PS Enum is [TreeScope]::Children
        // We might need to ensure casing matches or is handled.
        // The test just checks substrings.

        expect(decoded).to.contain('.FindAll([TreeScope]::');
        expect(decoded).to.contain('[AutomationElement]::classnameProperty');
    });

    it('should generate command for FoundAutomationElement', () => {
        const elementId = "42.1234.5";
        const element = new FoundAutomationElement(elementId);
        const command = element.buildCommand();
        const decoded = decodeCommand(command);

        // This uses ELEMENT_TABLE_GET
        // $el = $elementTable['42.1234.5'];
        expect(decoded).to.contain(`$elementTable['${elementId}']`);
    });
});
