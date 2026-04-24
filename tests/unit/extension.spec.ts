import { expect } from 'chai';
import { W3C_ELEMENT_KEY } from '@appium/base-driver';
import {
    patternInvoke,
    patternExpand,
    patternCollapse,
    patternToggle,
    patternSelect,
    patternAddToSelection,
    patternRemoveFromSelection,
    patternIsMultiple,
    patternGetSelectedItem,
    patternGetAllSelectedItems,
    patternGetValue,
    patternSetValue,
    patternMaximize,
    patternMinimize,
    patternRestore,
    patternClose,
    focusElement,
    pushCacheRequest,
    getClipboardBase64,
    setClipboardFromBase64,
    executePowerShellScript,
    typeDelay,
    getAttributes,
} from '../../lib/commands/extension';
import { decodePwsh } from '../../lib/powershell/core';

// A fake driver context that captures every `sendPowerShellCommand` call
// and returns canned values per-call.  Most extension commands are thin
// wrappers over `FoundAutomationElement.buildXCommand(...)` so we only need
// to check the decoded PS shape.

interface MockOpts {
    responses?: string[];              // queued responses, one per call (FIFO)
    defaultResponse?: string;
    caps?: any;
    isolatedResponses?: string[];
}

function makeMock(opts: MockOpts = {}) {
    const commands: string[] = [];
    const isolatedCommands: string[] = [];
    const responses = [...(opts.responses ?? [])];
    const isoResponses = [...(opts.isolatedResponses ?? [])];
    const mock: any = {
        caps: opts.caps ?? {},
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        sendPowerShellCommand: async (cmd: string): Promise<string> => {
            commands.push(decodePwsh(cmd));
            if (responses.length) return responses.shift()!;
            return opts.defaultResponse ?? '';
        },
        sendIsolatedPowerShellCommand: async (cmd: string): Promise<string> => {
            isolatedCommands.push(decodePwsh(cmd));
            if (isoResponses.length) return isoResponses.shift()!;
            return '';
        },
    };
    return { mock, commands, isolatedCommands };
}

function el(id = 'el-1') {
    return { [W3C_ELEMENT_KEY]: id } as any;
}

describe('extension — UIA pattern commands', () => {
    it('patternInvoke emits InvokePattern.Invoke()', async () => {
        const { mock, commands } = makeMock();
        await patternInvoke.call(mock, el('abc'));
        expect(commands).to.have.length(1);
        expect(commands[0]).to.contain('[InvokePattern]::Pattern');
        expect(commands[0]).to.contain('.Invoke()');
        expect(commands[0]).to.contain("'abc'");
    });

    it('patternExpand emits ExpandCollapsePattern.Expand()', async () => {
        const { mock, commands } = makeMock();
        await patternExpand.call(mock, el());
        expect(commands[0]).to.contain('ExpandCollapsePattern');
        expect(commands[0]).to.contain('.Expand()');
    });

    it('patternCollapse emits ExpandCollapsePattern.Collapse()', async () => {
        const { mock, commands } = makeMock();
        await patternCollapse.call(mock, el());
        expect(commands[0]).to.contain('.Collapse()');
    });

    it('patternToggle emits TogglePattern.Toggle()', async () => {
        const { mock, commands } = makeMock();
        await patternToggle.call(mock, el());
        expect(commands[0]).to.contain('TogglePattern');
        expect(commands[0]).to.contain('.Toggle()');
    });

    it('patternSelect emits SelectionItemPattern.Select()', async () => {
        const { mock, commands } = makeMock();
        await patternSelect.call(mock, el());
        expect(commands[0]).to.contain('.Select()');
    });

    it('patternAddToSelection emits SelectionItemPattern.AddToSelection()', async () => {
        const { mock, commands } = makeMock();
        await patternAddToSelection.call(mock, el());
        expect(commands[0]).to.contain('.AddToSelection()');
    });

    it('patternRemoveFromSelection emits SelectionItemPattern.RemoveFromSelection()', async () => {
        const { mock, commands } = makeMock();
        await patternRemoveFromSelection.call(mock, el());
        expect(commands[0]).to.contain('.RemoveFromSelection()');
    });

    it('patternMaximize emits WindowPattern.SetWindowVisualState(Maximized)', async () => {
        const { mock, commands } = makeMock();
        await patternMaximize.call(mock, el());
        expect(commands[0]).to.contain('WindowPattern');
        expect(commands[0]).to.contain('Maximized');
    });

    it('patternMinimize emits WindowPattern.SetWindowVisualState(Minimized)', async () => {
        const { mock, commands } = makeMock();
        await patternMinimize.call(mock, el());
        expect(commands[0]).to.contain('Minimized');
    });

    it('patternRestore emits WindowPattern.SetWindowVisualState(Normal)', async () => {
        const { mock, commands } = makeMock();
        await patternRestore.call(mock, el());
        expect(commands[0]).to.contain('Normal');
    });

    it('patternClose emits WindowPattern.Close() (wrapped in try/catch)', async () => {
        const { mock, commands } = makeMock();
        await patternClose.call(mock, el());
        expect(commands[0]).to.contain('.Close()');
        expect(commands[0]).to.contain('try {');
    });

    it('focusElement emits .SetFocus()', async () => {
        const { mock, commands } = makeMock();
        await focusElement.call(mock, el());
        expect(commands[0]).to.contain('.SetFocus()');
    });

    describe('patternIsMultiple', () => {
        it('returns true when PS returns "True"', async () => {
            const { mock } = makeMock({ defaultResponse: 'True' });
            const result = await patternIsMultiple.call(mock, el());
            expect(result).to.equal(true);
        });

        it('returns false when PS returns "False"', async () => {
            const { mock } = makeMock({ defaultResponse: 'False' });
            const result = await patternIsMultiple.call(mock, el());
            expect(result).to.equal(false);
        });

        it('returns false when PS returns an empty string', async () => {
            const { mock } = makeMock({ defaultResponse: '' });
            const result = await patternIsMultiple.call(mock, el());
            expect(result).to.equal(false);
        });
    });

    describe('patternGetSelectedItem', () => {
        it('wraps the returned runtime id in a W3C element ref', async () => {
            const { mock } = makeMock({ defaultResponse: '42.1.2\n' });
            const result = await patternGetSelectedItem.call(mock, el());
            expect(result).to.deep.equal({ [W3C_ELEMENT_KEY]: '42.1.2' });
        });

        it('throws NoSuchElementError when PS returns no id', async () => {
            const { mock } = makeMock({ defaultResponse: '' });
            try {
                await patternGetSelectedItem.call(mock, el());
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchElementError');
            }
        });
    });

    describe('patternGetAllSelectedItems', () => {
        it('returns an array of W3C refs (one per line)', async () => {
            const { mock } = makeMock({ defaultResponse: 'a.1\nb.2\nc.3' });
            const result = await patternGetAllSelectedItems.call(mock, el());
            expect(result).to.deep.equal([
                { [W3C_ELEMENT_KEY]: 'a.1' },
                { [W3C_ELEMENT_KEY]: 'b.2' },
                { [W3C_ELEMENT_KEY]: 'c.3' },
            ]);
        });

        it('returns an empty array when no selection', async () => {
            const { mock } = makeMock({ defaultResponse: '' });
            const result = await patternGetAllSelectedItems.call(mock, el());
            expect(result).to.deep.equal([]);
        });
    });

    describe('patternSetValue', () => {
        it('uses ValuePattern.SetValue for the first attempt', async () => {
            const { mock, commands } = makeMock();
            await patternSetValue.call(mock, el(), 'hello');
            expect(commands[0]).to.contain('ValuePattern');
            expect(commands[0]).to.contain('SetValue(');
        });

        it('falls back to RangeValuePattern if ValuePattern throws', async () => {
            const commands: string[] = [];
            let call = 0;
            const mock: any = {
                caps: {},
                log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
                sendPowerShellCommand: async (cmd: string): Promise<string> => {
                    commands.push(decodePwsh(cmd));
                    if (call++ === 0) throw new Error('ValuePattern not supported');
                    return '';
                },
            };
            await patternSetValue.call(mock, el(), '42');
            expect(commands).to.have.length(2);
            expect(commands[0]).to.contain('ValuePattern');
            expect(commands[1]).to.contain('RangeValuePattern');
        });

        // When BOTH pattern attempts fail, the thrown error must preserve both
        // underlying messages so the caller can tell what's actually wrong.
        it('composes both errors when ValuePattern and RangeValuePattern both fail', async () => {
            let call = 0;
            const mock: any = {
                caps: {},
                log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
                sendPowerShellCommand: async (): Promise<string> => {
                    if (call++ === 0) throw new Error('ValuePattern-not-supported-error');
                    throw new Error('RangeValuePattern-out-of-range-error');
                },
            };
            try {
                await patternSetValue.call(mock, el(), 'not-a-number');
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.message).to.contain('ValuePattern-not-supported-error');
                expect(e.message).to.contain('RangeValuePattern-out-of-range-error');
            }
        });
    });

    it('patternGetValue returns the raw PS response', async () => {
        const { mock } = makeMock({ defaultResponse: '42' });
        const result = await patternGetValue.call(mock, el());
        expect(result).to.equal('42');
    });
});

describe('extension — pushCacheRequest validation', () => {
    it('throws when no property is set', async () => {
        const { mock } = makeMock();
        try {
            await pushCacheRequest.call(mock, {} as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('sends a single TreeFilter PS command when only treeFilter is set', async () => {
        const { mock, commands } = makeMock();
        await pushCacheRequest.call(mock, {
            treeFilter: 'new PropertyCondition(NameProperty, "Calc")',
        });
        expect(commands).to.have.length(1);
        expect(commands[0]).to.contain('TreeFilter');
    });

    it('rejects a malformed treeFilter selector as InvalidArgumentError', async () => {
        // pushCacheRequest normalizes selector-parse errors to InvalidArgumentError
        // to stay consistent with the sibling treeScope / automationElementMode checks.
        const { mock } = makeMock();
        try {
            await pushCacheRequest.call(mock, { treeFilter: 'IsEnabled=True' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
            expect(e.message).to.match(/treeFilter/i);
        }
    });

    it('accepts a numeric TreeScope value (bitflag)', async () => {
        const { mock, commands } = makeMock();
        await pushCacheRequest.call(mock, { treeScope: '4' });
        expect(commands[0]).to.contain('TreeScope');
        expect(commands[0]).to.contain('4');
    });

    it('rejects a numeric TreeScope outside valid range', async () => {
        const { mock } = makeMock();
        try {
            await pushCacheRequest.call(mock, { treeScope: '99' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('sends a TreeScope PS command for a valid named scope', async () => {
        const { mock, commands } = makeMock();
        await pushCacheRequest.call(mock, { treeScope: 'Descendants' });
        expect(commands[0]).to.contain('TreeScope');
        expect(commands[0]).to.contain('Descendants');
    });

    it('rejects an unknown TreeScope value', async () => {
        const { mock } = makeMock();
        try {
            await pushCacheRequest.call(mock, { treeScope: 'NotARealScope' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('accepts a valid AutomationElementMode', async () => {
        const { mock, commands } = makeMock();
        await pushCacheRequest.call(mock, { automationElementMode: 'Full' });
        expect(commands[0]).to.contain('AutomationElementMode');
        expect(commands[0]).to.contain('Full');
    });

    it('rejects an invalid AutomationElementMode', async () => {
        const { mock } = makeMock();
        try {
            await pushCacheRequest.call(mock, { automationElementMode: 'Bogus' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('extension — clipboard', () => {
    describe('getClipboardBase64', () => {
        it('defaults to plaintext when called with no arg', async () => {
            const { mock, commands } = makeMock();
            await getClipboardBase64.call(mock);
            expect(commands[0]).to.contain('Get-Clipboard');
        });

        it('invokes image branch when contentType=image', async () => {
            const { mock, commands } = makeMock();
            await getClipboardBase64.call(mock, 'image');
            expect(commands[0]).to.contain('GetImage');
        });

        it('accepts options object with contentType', async () => {
            const { mock, commands } = makeMock();
            await getClipboardBase64.call(mock, { contentType: 'image' });
            expect(commands[0]).to.contain('GetImage');
        });

        it('rejects an unsupported contentType', async () => {
            const { mock } = makeMock();
            try {
                await getClipboardBase64.call(mock, 'garbage' as any);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });

    describe('setClipboardFromBase64', () => {
        it('rejects when b64Content is missing', async () => {
            const { mock } = makeMock();
            try {
                await setClipboardFromBase64.call(mock, {} as any);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('uses Set-Clipboard for plaintext content', async () => {
            const { mock, commands } = makeMock();
            await setClipboardFromBase64.call(mock, { b64Content: 'SGVsbG8=' });
            expect(commands[0]).to.contain('Set-Clipboard');
        });

        it('uses Windows.Clipboard.SetImage for image content', async () => {
            const { mock, commands } = makeMock();
            await setClipboardFromBase64.call(mock, { b64Content: 'AAAA', contentType: 'image' });
            expect(commands[0]).to.contain('SetImage');
        });

        it('rejects an unsupported contentType', async () => {
            const { mock } = makeMock();
            try {
                await setClipboardFromBase64.call(mock, { b64Content: 'x', contentType: 'nope' as any });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });
});

describe('extension — executePowerShellScript', () => {
    it('accepts a raw string', async () => {
        const { mock, commands } = makeMock();
        await executePowerShellScript.call(mock, 'Get-Process' as any);
        expect(commands).to.have.length(1);
        expect(decodePwsh(commands[0])).to.contain('Get-Process');
    });

    it('accepts { script: "..." }', async () => {
        const { mock, commands } = makeMock();
        await executePowerShellScript.call(mock, { script: 'Get-Service', command: undefined } as any);
        expect(decodePwsh(commands[0])).to.contain('Get-Service');
    });

    it('accepts { command: "..." }', async () => {
        const { mock, commands } = makeMock();
        await executePowerShellScript.call(mock, { script: undefined, command: 'Stop-Process' } as any);
        expect(decodePwsh(commands[0])).to.contain('Stop-Process');
    });

    it('throws when neither script nor command is provided', async () => {
        const { mock } = makeMock();
        try {
            await executePowerShellScript.call(mock, { script: undefined, command: undefined } as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('routes to the isolated channel when isolatedScriptExecution cap is true', async () => {
        const { mock, commands, isolatedCommands } = makeMock({ caps: { isolatedScriptExecution: true } });
        await executePowerShellScript.call(mock, 'Get-Process' as any);
        expect(commands).to.have.length(0);
        expect(isolatedCommands).to.have.length(1);
    });
});

describe('extension — typeDelay', () => {
    it('sets caps.typeDelay from { delay: N }', async () => {
        const { mock } = makeMock();
        await typeDelay.call(mock, { delay: 250 });
        expect(mock.caps.typeDelay).to.equal(250);
    });

    it('sets caps.typeDelay from a bare number', async () => {
        const { mock } = makeMock();
        await typeDelay.call(mock, 150);
        expect(mock.caps.typeDelay).to.equal(150);
    });

    it('sets caps.typeDelay from a numeric string', async () => {
        const { mock } = makeMock();
        await typeDelay.call(mock, '75');
        expect(mock.caps.typeDelay).to.equal(75);
    });

    it('rejects negative delays', async () => {
        const { mock } = makeMock();
        try {
            await typeDelay.call(mock, -5);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('rejects non-numeric strings', async () => {
        const { mock } = makeMock();
        try {
            await typeDelay.call(mock, 'abc');
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('rejects undefined args', async () => {
        const { mock } = makeMock();
        try {
            await typeDelay.call(mock, undefined);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('extension — getAttributes', () => {
    it('accepts a W3C element object', async () => {
        const { mock, commands } = makeMock();
        await getAttributes.call(mock, { [W3C_ELEMENT_KEY]: 'abc' });
        expect(commands).to.have.length(1);
        expect(commands[0]).to.contain("'abc'");
    });

    it('accepts { elementId: "..." }', async () => {
        const { mock, commands } = makeMock();
        await getAttributes.call(mock, { elementId: 'xyz' });
        expect(commands[0]).to.contain("'xyz'");
    });

    it('accepts a bare string id', async () => {
        const { mock, commands } = makeMock();
        await getAttributes.call(mock, 'def');
        expect(commands[0]).to.contain("'def'");
    });

    it('rejects null / undefined', async () => {
        const { mock } = makeMock();
        try {
            await getAttributes.call(mock, null);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});
