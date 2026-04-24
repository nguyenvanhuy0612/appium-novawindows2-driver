
import { expect } from 'chai';
import {
    AutomationElement,
    PropertyCondition,
    Property,
    PSString,
    TreeScope,
    FoundAutomationElement
} from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';

function decodeCommand(cmd: string): string {
    return decodePwsh(cmd);
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

        expect(decoded).to.contain('Find-Descendant');
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

    it('should generate correct buildInvokeCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildInvokeCommand());
        expect(cmd).to.contain('GetCurrentPattern([InvokePattern]::Pattern).Invoke()');
    });

    it('should generate correct buildScrollIntoViewCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildScrollIntoViewCommand());
        expect(cmd).to.contain('ScrollItemPattern');
        expect(cmd).to.contain('SetFocus');
    });

    it('should generate correct buildBringToFrontCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildBringToFrontCommand());
        // Invokes the Win32Helper::BringToForeground wrapper, which internally
        // performs SetForegroundWindow + ShowWindow + BringWindowToTop with
        // retries. The PS command visibly references BringToForeground; the
        // SetForegroundWindow call itself is inside the C# helper source.
        expect(cmd).to.contain('Win32Helper');
        expect(cmd).to.contain('BringToForeground');
    });

    it('should generate correct buildSetFocusCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildSetFocusCommand());
        expect(cmd).to.contain('SetFocus()');
    });

    it('should generate correct buildSetValueCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildSetValueCommand('hello'));
        expect(cmd).to.contain('ValuePattern');
        expect(cmd).to.contain('SetValue("$([char]0x0068)$([char]0x0065)$([char]0x006c)$([char]0x006c)$([char]0x006f)")');
    });

    it('should generate correct buildMaximizeCommand', () => {
        const el = new FoundAutomationElement('123');
        const cmd = decodeCommand(el.buildMaximizeCommand());
        expect(cmd).to.contain('WindowVisualState]::Maximized');
    });

    describe('Additional Search Scopes', () => {
        const root = AutomationElement.automationRoot;
        const cond = new PropertyCondition(Property.NAME, new PSString('Test'));

        it('should handle ANCESTORS scope', () => {
            const cmd = decodeCommand(root.findAll(TreeScope.ANCESTORS, cond).buildCommand());
            expect(cmd).to.contain('$treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)');
            expect(cmd).to.contain('GetParent($el)');
        });

        it('should handle SUBTREE scope', () => {
            const cmd = decodeCommand(root.findFirst(TreeScope.SUBTREE, cond).buildCommand());
            expect(cmd).to.contain('Find-Descendant');
            expect(cmd).to.contain('-includeSelf');
        });
    });

    describe('Additional Element Actions', () => {
        const el = new FoundAutomationElement('456');

        it('should generate correct buildMinimizeCommand', () => {
            const cmd = decodeCommand(el.buildMinimizeCommand());
            expect(cmd).to.contain('WindowVisualState]::Minimized');
        });

        it('should generate correct buildRestoreCommand', () => {
            const cmd = decodeCommand(el.buildRestoreCommand());
            expect(cmd).to.contain('WindowVisualState]::Normal');
        });

        it('should generate correct buildCloseCommand', () => {
            const cmd = decodeCommand(el.buildCloseCommand());
            expect(cmd).to.contain('.Close()');
        });
    });
});
