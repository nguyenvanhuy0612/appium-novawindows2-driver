import { expect } from 'chai';
import { FoundAutomationElement } from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';

describe('getProperty PS command builders', () => {
    const el = new FoundAutomationElement('1.2.3');

    describe('buildGetPropertyCommand (UIA basic — used by XPath)', () => {
        it('generates UIA direct property lookup for Name', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('Name'));
            expect(cmd).to.contain('[System.Windows.Automation.AutomationElement]::NameProperty');
            expect(cmd).to.contain('GetCurrentPropertyValue');
        });

        it('generates RuntimeId command for runtimeid', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('runtimeid'));
            expect(cmd).to.contain('RuntimeIdProperty');
            expect(cmd).to.not.contain('GetCurrentPattern');
        });

        it('generates tag name command for controltype', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('controltype'));
            expect(cmd).to.contain('ControlType');
            expect(cmd).to.contain('ProgrammaticName');
        });

        it('generates all-properties dump via buildGetAllPropertiesCommand', () => {
            const cmd = decodePwsh(el.buildGetAllPropertiesCommand());
            expect(cmd).to.contain('GetSupportedProperties');
            expect(cmd).to.contain('ConvertTo-Json');
        });

        it('does NOT use GetCurrentPattern for standard properties', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('IsEnabled'));
            expect(cmd).to.not.contain('GetCurrentPattern');
        });
    });

    describe('buildGetPatternPropertyCommand (UIA pattern)', () => {
        it('uses TogglePattern for Toggle.ToggleState', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Toggle', 'ToggleState'));
            expect(cmd).to.contain('[System.Windows.Automation.TogglePattern]::Pattern');
            expect(cmd).to.contain('GetCurrentPattern');
            expect(cmd).to.contain('.Current.ToggleState');
        });

        it('uses ValuePattern for Value.Value', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Value', 'Value'));
            expect(cmd).to.contain('[System.Windows.Automation.ValuePattern]::Pattern');
            expect(cmd).to.contain('.Current.Value');
        });

        it('uses WindowPattern for Window.CanMaximize', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Window', 'CanMaximize'));
            expect(cmd).to.contain('[System.Windows.Automation.WindowPattern]::Pattern');
            expect(cmd).to.contain('.Current.CanMaximize');
        });

        it('uses TransformPattern for Transform.CanMove', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Transform', 'CanMove'));
            expect(cmd).to.contain('[System.Windows.Automation.TransformPattern]::Pattern');
            expect(cmd).to.contain('.Current.CanMove');
        });

        it('uses ExpandCollapsePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('ExpandCollapse', 'ExpandCollapseState'));
            expect(cmd).to.contain('[System.Windows.Automation.ExpandCollapsePattern]::Pattern');
            expect(cmd).to.contain('.Current.ExpandCollapseState');
        });

        it('uses RangeValuePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('RangeValue', 'Value'));
            expect(cmd).to.contain('[System.Windows.Automation.RangeValuePattern]::Pattern');
        });

        it('does NOT use LegacyIAccessiblePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Toggle', 'ToggleState'));
            expect(cmd).to.not.contain('LegacyIAccessiblePattern');
            expect(cmd).to.not.contain('MSAAHelper');
        });
    });

    describe('buildGetLegacyPropertyCommand (LegacyIAccessible / MSAA)', () => {
        it('tries LegacyIAccessiblePattern first for Name', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.contain('[System.Windows.Automation.LegacyIAccessiblePattern]::Pattern');
            expect(cmd).to.contain('.Current.Name');
        });

        it('falls back to MSAAHelper for Name', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.contain('MSAAHelper');
            expect(cmd).to.contain('"Name"');
        });

        it('uses correct prop name for Value', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Value'));
            expect(cmd).to.contain('.Current.Value');
            expect(cmd).to.contain('"Value"');
        });

        it('uses correct prop name for ChildId', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('ChildId'));
            expect(cmd).to.contain('.Current.ChildId');
            expect(cmd).to.contain('"ChildId"');
        });

        it('does NOT use AutomationElement direct property lookup', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.not.contain('AutomationElement]::NameProperty');
        });
    });

    describe('routing isolation: XPath path vs getProperty path', () => {
        it('buildGetPropertyCommand never references LegacyIAccessiblePattern', () => {
            const props = ['Name', 'AutomationId', 'ClassName', 'IsEnabled', 'IsOffscreen', 'ProcessId'];
            for (const prop of props) {
                const cmd = decodePwsh(el.buildGetPropertyCommand(prop));
                expect(cmd).to.not.contain('LegacyIAccessiblePattern');
                expect(cmd).to.not.contain('MSAAHelper');
                expect(cmd).to.not.contain('GetCurrentPattern');
            }
        });

        it('buildGetPatternPropertyCommand never uses AutomationElement property lookup', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('Toggle', 'ToggleState'));
            expect(cmd).to.not.contain('AutomationElement]::');
        });

        it('buildGetLegacyPropertyCommand never uses AutomationElement property lookup', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.not.contain('AutomationElement]::NameProperty');
        });
    });
});
