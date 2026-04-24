
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

        describe('FIND_PARENT — parent:: axis', () => {
            it('stores parent in variable before null check', () => {
                const cmd = decodePwsh(root.findFirst(TreeScope.PARENT, cond).buildCommand());
                expect(cmd).to.contain('$parent = $treeWalker.GetParent($el)');
            });

            it('guards against null parent before calling FindFirst', () => {
                const cmd = decodePwsh(root.findFirst(TreeScope.PARENT, cond).buildCommand());
                expect(cmd).to.contain('if ($null -ne $parent)');
            });
        });

        describe('FIND_ALL_FOLLOWING — following:: axis', () => {
            it('uses Subtree scope to match sibling and all its descendants', () => {
                const cmd = decodePwsh(root.findAll(TreeScope.FOLLOWING, cond).buildCommand());
                expect(cmd).to.contain('[TreeScope]::Subtree');
            });

            it('only moves to parent when no next sibling found (else branch)', () => {
                const cmd = decodePwsh(root.findAll(TreeScope.FOLLOWING, cond).buildCommand());
                expect(cmd).to.contain('} else {');
                expect(cmd).to.contain('$treeWalker.GetParent($el)');
            });

            it('does not add sibling unconditionally — uses FindAll with condition', () => {
                const cmd = decodePwsh(root.findAll(TreeScope.FOLLOWING, cond).buildCommand());
                expect(cmd).to.contain('$el.FindAll([TreeScope]::Subtree');
            });
        });

        describe('FIND_ALL_PRECEDING — preceding:: axis', () => {
            it('uses Subtree scope to match sibling and all its descendants', () => {
                const cmd = decodePwsh(root.findAll(TreeScope.PRECEDING, cond).buildCommand());
                expect(cmd).to.contain('[TreeScope]::Subtree');
            });

            it('only moves to parent when no previous sibling found (else branch)', () => {
                const cmd = decodePwsh(root.findAll(TreeScope.PRECEDING, cond).buildCommand());
                expect(cmd).to.contain('} else {');
                expect(cmd).to.contain('$treeWalker.GetParent($el)');
            });
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

        it('buildMoveCommand uses TransformPattern.Move with the given coordinates', () => {
            const cmd = decodePwsh(el.buildMoveCommand(100, 200));
            expect(cmd).to.contain('[TransformPattern]::Pattern');
            expect(cmd).to.contain('.Move(100, 200)');
        });

        it('buildMoveCommand handles zero and negative coordinates', () => {
            const atOrigin = decodePwsh(el.buildMoveCommand(0, 0));
            expect(atOrigin).to.contain('.Move(0, 0)');

            const offscreen = decodePwsh(el.buildMoveCommand(-50, -100));
            expect(offscreen).to.contain('.Move(-50, -100)');
        });

        it('buildResizeCommand uses TransformPattern.Resize with the given dimensions', () => {
            const cmd = decodePwsh(el.buildResizeCommand(800, 600));
            expect(cmd).to.contain('[TransformPattern]::Pattern');
            expect(cmd).to.contain('.Resize(800, 600)');
        });

        it('buildResizeCommand emits each element id into the template', () => {
            const elA = new FoundAutomationElement('abc-123');
            const cmd = decodePwsh(elA.buildResizeCommand(1024, 768));
            expect(cmd).to.contain("'abc-123'");
            expect(cmd).to.contain('.Resize(1024, 768)');
        });

        it('buildGetTagNameCommand handles special mappings', () => {
            const cmd = decodePwsh(el.buildGetTagNameCommand());
            expect(cmd).to.contain("$type = $_.Split('.')[-1];");
            expect(cmd).to.contain("if ($type -eq 'DataGrid') {");
        });
    });

    describe('AutomationElement.getPropertyAccessor (contains/starts-with psFilter)', () => {
        it('uses $_.Current.Name not $_.CurrentName', () => {
            expect(AutomationElement.getPropertyAccessor('Name')).to.equal('$_.Current.Name');
        });

        it('uses $_.Current.* form for all properties', () => {
            const props = ['Name', 'AutomationId', 'ClassName', 'IsEnabled', 'IsOffscreen',
                           'HelpText', 'FrameworkId', 'LocalizedControlType', 'AccessKey'];
            for (const prop of props) {
                const accessor = AutomationElement.getPropertyAccessor(prop);
                expect(accessor, `accessor for ${prop}`).to.match(/^\$_\.Current\./);
            }
        });

        it('returns undefined for unknown properties', () => {
            expect(AutomationElement.getPropertyAccessor('RuntimeId')).to.be.undefined;
            expect(AutomationElement.getPropertyAccessor('BoundingRectangle')).to.be.undefined;
        });
    });
});
