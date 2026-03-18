
import { expect } from 'chai';
import {
    AutomationElement,
    FoundAutomationElement,
    PropertyCondition,
    Property,
    PSString,
    TreeScope
} from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';

describe('Automation Elements', () => {
    describe('AutomationElement (Search)', () => {
        const root = AutomationElement.automationRoot;
        const cond = new PropertyCondition(Property.NAME, new PSString('Test'));

        it('findFirst generates correct command for DESCENDANTS', () => {
            const cmd = decodePwsh(root.findFirst(TreeScope.DESCENDANTS, cond).buildCommand());
            expect(cmd).to.contain('Find-Descendant');
            expect(cmd).to.contain('[AutomationElement]::nameProperty');
        });

        it('findAll generates correct command for DESCENDANTS', () => {
            const cmd = decodePwsh(root.findAll(TreeScope.DESCENDANTS, cond).buildCommand());
            expect(cmd).to.contain('Find-AllDescendants');
        });

        it('findFirst generates correct command for CHILDREN_OR_SELF', () => {
             const cmd = decodePwsh(root.findFirst(TreeScope.CHILDREN_OR_SELF, cond).buildCommand());
             expect(cmd).to.contain('System.Collections.Generic.List[AutomationElement]');
             expect(cmd).to.contain('-bor [TreeScope]::Children');
        });
    });

    describe('FoundAutomationElement (Actions)', () => {
        const el = new FoundAutomationElement('123');

        it('buildInvokeCommand generates correct PowerShell', () => {
            const cmd = decodePwsh(el.buildInvokeCommand());
            expect(cmd).to.contain('GetCurrentPattern([InvokePattern]::Pattern).Invoke()');
        });

        it('buildGetTextCommand generates correct PowerShell', () => {
            const cmd = decodePwsh(el.buildGetTextCommand());
            expect(cmd).to.contain('.Current.Name');
        });

        it('buildSetFocusCommand generates correct PowerShell', () => {
            const cmd = decodePwsh(el.buildSetFocusCommand());
            expect(cmd).to.contain('.SetFocus()');
        });

        it('buildExpandCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildExpandCommand())).to.contain('Expand()');
        });

        it('buildCollapseCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildCollapseCommand())).to.contain('Collapse()');
        });

        it('buildGetToggleStateCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildGetToggleStateCommand())).to.contain('ToggleState');
        });

        it('buildSelectCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildSelectCommand())).to.contain('Select()');
        });

        it('buildSetValueCommand handles encoding', () => {
             const cmd = decodePwsh(el.buildSetValueCommand('abc'));
             expect(cmd).to.contain('SetValue(');
             expect(cmd).to.contain('0061'); // 'a'
        });

        it('buildSetRangeValueCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildSetRangeValueCommand('50'))).to.contain('RangeValuePattern');
             expect(decodePwsh(el.buildSetRangeValueCommand('50'))).to.contain('SetValue(50)');
        });

        it('buildRestoreCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildRestoreCommand())).to.contain('WindowVisualState]::Normal');
        });

        it('buildCloseCommand generates correct PowerShell', () => {
             expect(decodePwsh(el.buildCloseCommand())).to.contain('Close()');
        });

        it('buildGetTagNameCommand handles special mappings', () => {
            const cmd = decodePwsh(el.buildGetTagNameCommand());
            expect(cmd).to.contain("$type = $_.Split('.')[-1];");
            expect(cmd).to.contain("if ($type -eq 'DataGrid') {");
        });
    });
});
