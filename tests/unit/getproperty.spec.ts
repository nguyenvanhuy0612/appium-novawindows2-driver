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

        it('generates UIA direct property lookup for IsOffscreen', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('IsOffscreen'));
            expect(cmd).to.contain('[System.Windows.Automation.AutomationElement]::IsOffscreenProperty');
        });

        it('generates UIA direct property lookup for ProcessId', () => {
            const cmd = decodePwsh(el.buildGetPropertyCommand('ProcessId'));
            expect(cmd).to.contain('[System.Windows.Automation.AutomationElement]::ProcessIdProperty');
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
            expect(cmd).to.contain("'DataGrid'");
            expect(cmd).to.contain("'List'");
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

        it('buildGetTagNameCommand maps DataGrid to List', () => {
            const cmd = decodePwsh(el.buildGetTagNameCommand());
            expect(cmd).to.contain('DataGrid');
            expect(cmd).to.contain("'List'");
        });

        it('buildGetTagNameCommand maps DataItem to ListItem', () => {
            const cmd = decodePwsh(el.buildGetTagNameCommand());
            expect(cmd).to.contain('DataItem');
            expect(cmd).to.contain("'ListItem'");
        });
    });

    describe('buildGetPatternPropertyCommand (UIA pattern)', () => {
        it('uses TogglePattern for Toggle.ToggleState', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('TogglePattern', 'ToggleState'));
            expect(cmd).to.contain('[System.Windows.Automation.TogglePattern]::Pattern');
            expect(cmd).to.contain('GetCurrentPattern');
            expect(cmd).to.contain('.Current.ToggleState');
        });

        it('uses ValuePattern for Value.Value', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('ValuePattern', 'Value'));
            expect(cmd).to.contain('[System.Windows.Automation.ValuePattern]::Pattern');
            expect(cmd).to.contain('.Current.Value');
        });

        it('uses WindowPattern for Window.CanMaximize', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('WindowPattern', 'CanMaximize'));
            expect(cmd).to.contain('[System.Windows.Automation.WindowPattern]::Pattern');
            expect(cmd).to.contain('.Current.CanMaximize');
        });

        it('uses TransformPattern for Transform.CanMove', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('TransformPattern', 'CanMove'));
            expect(cmd).to.contain('[System.Windows.Automation.TransformPattern]::Pattern');
            expect(cmd).to.contain('.Current.CanMove');
        });

        it('uses ExpandCollapsePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('ExpandCollapsePattern', 'ExpandCollapseState'));
            expect(cmd).to.contain('[System.Windows.Automation.ExpandCollapsePattern]::Pattern');
            expect(cmd).to.contain('.Current.ExpandCollapseState');
        });

        it('uses RangeValuePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('RangeValuePattern', 'Value'));
            expect(cmd).to.contain('[System.Windows.Automation.RangeValuePattern]::Pattern');
        });

        it('does NOT use LegacyIAccessiblePattern', () => {
            const cmd = decodePwsh(el.buildGetPatternPropertyCommand('TogglePattern', 'ToggleState'));
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

    describe('buildGetSourceCommand (element XML source)', () => {
        it('calls Get-PageSource with the element', () => {
            const cmd = decodePwsh(el.buildGetSourceCommand());
            expect(cmd).to.contain('Get-PageSource $el');
        });

        it('returns OuterXml of the source', () => {
            const cmd = decodePwsh(el.buildGetSourceCommand());
            expect(cmd).to.contain('$source.OuterXml');
        });

        it('guards against null element', () => {
            const cmd = decodePwsh(el.buildGetSourceCommand());
            expect(cmd).to.contain('if ($null -eq $el)');
        });
    });

    describe('NaN BoundingRectangle guard (offscreen elements)', () => {
        it('buildGetLegacyPropertyCommand defaults centerX/centerY to 0', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.contain('$centerX = 0; $centerY = 0');
        });

        it('buildGetLegacyPropertyCommand wraps [int] cast in inner try-catch', () => {
            const cmd = decodePwsh(el.buildGetLegacyPropertyCommand('Name'));
            expect(cmd).to.contain('try { $centerX = [int]');
        });

        it('buildGetAllPropertiesCommand defaults cx/cy to 0', () => {
            const cmd = decodePwsh(el.buildGetAllPropertiesCommand());
            expect(cmd).to.contain('$cx = 0; $cy = 0');
        });

        it('buildGetAllPropertiesCommand wraps [int] cast in inner try-catch', () => {
            const cmd = decodePwsh(el.buildGetAllPropertiesCommand());
            expect(cmd).to.contain('try { $cx = [int]');
        });
    });

    describe('additional properties coverage', () => {
         it('buildGetPropertyCommand handles BoundingRectangle', () => {
              const cmd = decodePwsh(el.buildGetPropertyCommand('BoundingRectangle'));
              expect(cmd).to.contain('BoundingRectangleProperty');
         });

         it('buildGetPropertyCommand handles FrameworkId', () => {
              const cmd = decodePwsh(el.buildGetPropertyCommand('FrameworkId'));
              expect(cmd).to.contain('FrameworkIdProperty');
         });

         it('buildGetPatternPropertyCommand handles ScrollPattern', () => {
              const cmd = decodePwsh(el.buildGetPatternPropertyCommand('ScrollPattern', 'VerticalScrollPercent'));
              expect(cmd).to.contain('ScrollPattern');
              expect(cmd).to.contain('VerticalScrollPercent');
         });
    });
});
