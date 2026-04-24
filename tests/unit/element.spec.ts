import { expect } from 'chai';
import { W3C_ELEMENT_KEY } from '@appium/base-driver';
import {
    active,
    clear,
    elementDisplayed,
    elementEnabled,
    elementSelected,
    getAttribute,
    getElementRect,
    getElementScreenshot,
    getName,
    getProperty,
    getText,
    setValue,
} from '../../lib/commands/element';
import { decodePwsh } from '../../lib/powershell/core';
import { Key } from '../../lib/enums';

// Mock driver infrastructure for element-command tests.
//
// The commands in lib/commands/element.ts are thin wrappers that build a
// PowerShell command via FoundAutomationElement's builder methods and hand
// it off to sendPowerShellCommand. We verify the *shape* of the emitted PS
// commands plus the JS-level logic (routing in getProperty, coordinate
// arithmetic in getElementRect, boolean coercion in elementDisplayed/etc).

interface MockOpts {
    responses?: string[];                       // FIFO queued responses
    defaultResponse?: string;
    caps?: any;
    throwOnIndex?: number[];                    // indices (0-based) to throw from
    keyActionSequences?: boolean;               // if true, mock handleKeyActionSequence as a spy
}

function makeMock(opts: MockOpts = {}) {
    const commands: string[] = [];
    const responses = [...(opts.responses ?? [])];
    const throwSet = new Set(opts.throwOnIndex ?? []);
    const keySequences: any[] = [];

    const mock: any = {
        caps: opts.caps ?? {},
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        sendPowerShellCommand: async (cmd: string): Promise<string> => {
            const idx = commands.length;
            commands.push(decodePwsh(cmd));
            if (throwSet.has(idx)) throw new Error(`mock: throwing at index ${idx}`);
            if (responses.length) return responses.shift()!;
            return opts.defaultResponse ?? '';
        },
    };
    if (opts.keyActionSequences) {
        mock.handleKeyActionSequence = async (seq: any) => {
            keySequences.push(seq);
        };
    }
    return { mock, commands, keySequences };
}

describe('element — simple wrappers', () => {
    describe('active()', () => {
        it('returns the focused element id wrapped as W3C ref', async () => {
            const { mock } = makeMock({ defaultResponse: 'focused-42' });
            const result = await active.call(mock);
            expect(result).to.deep.equal({ [W3C_ELEMENT_KEY]: 'focused-42' });
        });

        it('queries FocusedElement via PS command', async () => {
            const { mock, commands } = makeMock({ defaultResponse: 'f' });
            await active.call(mock);
            expect(commands[0]).to.contain('FocusedElement');
        });
    });

    describe('getName()', () => {
        it('sends a GetTagName PS command with the right element id', async () => {
            const { mock, commands } = makeMock({ defaultResponse: 'Button' });
            const result = await getName.call(mock, 'el-99');
            expect(result).to.equal('Button');
            expect(commands[0]).to.contain("'el-99'");
            expect(commands[0]).to.contain('ControlType');
        });
    });

    describe('getText()', () => {
        it('returns the result of the GetText PS command', async () => {
            const { mock, commands } = makeMock({ defaultResponse: 'hello' });
            const result = await getText.call(mock, 'el-1');
            expect(result).to.equal('hello');
            expect(commands).to.have.length(1);
        });
    });

    describe('clear()', () => {
        it('sends a SetValue PS command with an empty string', async () => {
            const { mock, commands } = makeMock();
            await clear.call(mock, 'el-1');
            expect(commands[0]).to.contain('SetValue(');
            expect(commands[0]).to.contain('ValuePattern');
        });
    });

    describe('getElementScreenshot()', () => {
        it('forwards to the screenshot PS command and returns its base64 output', async () => {
            const { mock, commands } = makeMock({ defaultResponse: 'iVBORw0KGgo=' });
            const result = await getElementScreenshot.call(mock, 'el-1');
            expect(result).to.equal('iVBORw0KGgo=');
            expect(commands).to.have.length(1);
        });
    });
});

describe('element — boolean property coercion', () => {
    describe('elementDisplayed()', () => {
        it('returns true when IsOffscreen is "False"', async () => {
            const { mock } = makeMock({ defaultResponse: 'False' });
            expect(await elementDisplayed.call(mock, 'el')).to.equal(true);
        });

        it('returns false when IsOffscreen is "True"', async () => {
            const { mock } = makeMock({ defaultResponse: 'True' });
            expect(await elementDisplayed.call(mock, 'el')).to.equal(false);
        });

        it('is case-insensitive on the PS boolean string', async () => {
            const { mock } = makeMock({ defaultResponse: 'TRUE' });
            expect(await elementDisplayed.call(mock, 'el')).to.equal(false);
        });
    });

    describe('elementSelected()', () => {
        it('returns true when IsSelected returns "True"', async () => {
            const { mock } = makeMock({ defaultResponse: 'True' });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });

        it('returns false when IsSelected returns "False"', async () => {
            const { mock } = makeMock({ defaultResponse: 'False' });
            expect(await elementSelected.call(mock, 'el')).to.equal(false);
        });

        it('falls back to ToggleState="On" when IsSelected throws', async () => {
            // First call throws (no response dequeued), second call returns 'On'.
            const { mock } = makeMock({ responses: ['On'], throwOnIndex: [0] });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });

        it('ToggleState "Off" returns false under fallback path', async () => {
            const { mock } = makeMock({ responses: ['Off'], throwOnIndex: [0] });
            expect(await elementSelected.call(mock, 'el')).to.equal(false);
        });

        // Regression: elementSelected used strict-case === 'True' / === 'On'
        // while sibling booleans (elementDisplayed, elementEnabled, patternIsMultiple)
        // used case-insensitive comparison. If PS ever returned 'true'/'TRUE'/'on'
        // instead, elementSelected would silently return false.
        it('accepts case-variant "TRUE" from IsSelected', async () => {
            const { mock } = makeMock({ defaultResponse: 'TRUE' });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });

        it('accepts case-variant "true" from IsSelected', async () => {
            const { mock } = makeMock({ defaultResponse: 'true' });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });

        it('accepts case-variant "ON" from ToggleState fallback', async () => {
            const { mock } = makeMock({ responses: ['ON'], throwOnIndex: [0] });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });

        it('accepts case-variant "on" from ToggleState fallback', async () => {
            const { mock } = makeMock({ responses: ['on'], throwOnIndex: [0] });
            expect(await elementSelected.call(mock, 'el')).to.equal(true);
        });
    });

    describe('elementEnabled()', () => {
        it('returns true when IsEnabled is "True"', async () => {
            const { mock } = makeMock({ defaultResponse: 'True' });
            expect(await elementEnabled.call(mock, 'el')).to.equal(true);
        });

        it('returns false when IsEnabled is "False"', async () => {
            const { mock } = makeMock({ defaultResponse: 'False' });
            expect(await elementEnabled.call(mock, 'el')).to.equal(false);
        });
    });
});

describe('element — getElementRect (root-relative coordinates)', () => {
    it('subtracts the root window origin from the element origin', async () => {
        // Element sits at (150, 250), root window at (10, 20).
        // Expected relative coords: (140, 230).
        const { mock } = makeMock({
            responses: [
                JSON.stringify({ x: 150, y: 250, width: 80, height: 30 }),
                JSON.stringify({ x: 10, y: 20, width: 1000, height: 800 }),
            ],
        });
        const rect = await getElementRect.call(mock, 'el-1');
        expect(rect).to.deep.equal({ x: 140, y: 230, width: 80, height: 30 });
    });

    it('clamps coordinates to INT32_MAX upper bound', async () => {
        const { mock } = makeMock({
            responses: [
                JSON.stringify({ x: 0x7FFFFFF0, y: 0x7FFFFFF0, width: 10, height: 10 }),
                JSON.stringify({ x: 0, y: 0, width: 1, height: 1 }),
            ],
        });
        const rect = await getElementRect.call(mock, 'el-1');
        expect(rect.x).to.be.lessThanOrEqual(0x7FFFFFFF);
        expect(rect.y).to.be.lessThanOrEqual(0x7FFFFFFF);
    });

    it('replaces "Infinity" strings in the JSON response', async () => {
        const { mock } = makeMock({
            responses: [
                '{"x":Infinity,"y":10,"width":20,"height":30}',
                '{"x":0,"y":0,"width":100,"height":100}',
            ],
        });
        const rect = await getElementRect.call(mock, 'el-1');
        // Infinity becomes INT32_MAX; getting ANY finite value is the contract.
        expect(Number.isFinite(rect.x)).to.equal(true);
    });
});

describe('element — getProperty resolution order', () => {
    it('1. Legacy shorthand alias → buildGetLegacyPropertyCommand', async () => {
        // "LegacyName" → LegacyIAccessiblePattern.Current.Name
        const { mock, commands } = makeMock({ defaultResponse: 'foo' });
        const result = await getProperty.call(mock, 'LegacyName', 'el-1');
        expect(result).to.equal('foo');
        expect(commands).to.have.length(1);
        expect(commands[0]).to.contain('LegacyIAccessiblePattern');
        expect(commands[0]).to.contain('.Current.Name');
    });

    it('1. Legacy aliases are case-insensitive', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'x' });
        await getProperty.call(mock, 'LEGACYVALUE', 'el-1');
        expect(commands[0]).to.contain('.Current.Value');
    });

    it('1. LegacyRole / LegacyState / LegacyHelp etc. all map through the alias table', async () => {
        for (const [input, expected] of [
            ['LegacyRole', '.Current.Role'],
            ['LegacyState', '.Current.State'],
            ['LegacyHelp', '.Current.Help'],
            ['LegacyKeyboardShortcut', '.Current.KeyboardShortcut'],
            ['LegacyDefaultAction', '.Current.DefaultAction'],
            ['LegacyChildId', '.Current.ChildId'],
            ['LegacyDescription', '.Current.Description'],
        ] as const) {
            const { mock, commands } = makeMock({ defaultResponse: 'x' });
            await getProperty.call(mock, input, 'el-1');
            expect(commands[0], `alias ${input}`).to.contain(expected);
        }
    });

    it('2. "LegacyIAccessible.Name" dot-notation → buildGetLegacyPropertyCommand("Name")', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'v' });
        await getProperty.call(mock, 'LegacyIAccessible.Name', 'el-1');
        expect(commands[0]).to.contain('LegacyIAccessiblePattern');
        expect(commands[0]).to.contain('.Current.Name');
    });

    it('3. Pattern dot-notation "Value.Value" → buildGetPatternPropertyCommand("ValuePattern","Value")', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'hi' });
        const result = await getProperty.call(mock, 'Value.Value', 'el-1');
        expect(result).to.equal('hi');
        expect(commands[0]).to.contain('[System.Windows.Automation.ValuePattern]::Pattern');
        expect(commands[0]).to.contain('.Current.Value');
    });

    it('3. Pattern dot-notation "Toggle.ToggleState" routes to TogglePattern', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'On' });
        await getProperty.call(mock, 'Toggle.ToggleState', 'el-1');
        expect(commands[0]).to.contain('TogglePattern');
        expect(commands[0]).to.contain('.Current.ToggleState');
    });

    it('3. Pattern dot-notation "Window.CanMaximize" routes to WindowPattern', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'True' });
        await getProperty.call(mock, 'Window.CanMaximize', 'el-1');
        expect(commands[0]).to.contain('WindowPattern');
        expect(commands[0]).to.contain('.Current.CanMaximize');
    });

    it('3. Pattern2 variants resolve to their real class name (TransformPattern2, etc.)', async () => {
        const { mock, commands } = makeMock({ defaultResponse: '' });
        await getProperty.call(mock, 'Transform2.ZoomLevel', 'el-1');
        expect(commands[0]).to.contain('TransformPattern2');
    });

    it('3. Pattern result falls back to LegacyIAccessible when PS returns empty for "Value.Value"', async () => {
        // First call (ValuePattern) returns empty → triggers legacy fallback call.
        const { mock, commands } = makeMock({ responses: ['', 'legacy-value'] });
        const result = await getProperty.call(mock, 'Value.Value', 'el-1');
        expect(result).to.equal('legacy-value');
        expect(commands).to.have.length(2);
        expect(commands[1]).to.contain('LegacyIAccessiblePattern');
    });

    it('4. "source" keyword → buildGetSourceCommand', async () => {
        const { mock, commands } = makeMock({ defaultResponse: '<root/>' });
        const result = await getProperty.call(mock, 'source', 'el-1');
        expect(result).to.equal('<root/>');
        expect(commands[0]).to.contain('Get-PageSource');
    });

    it('5. "all" keyword → buildGetAllPropertiesCommand', async () => {
        const { mock, commands } = makeMock({ defaultResponse: '{}' });
        await getProperty.call(mock, 'all', 'el-1');
        expect(commands[0]).to.contain('GetSupportedProperties');
        expect(commands[0]).to.contain('ConvertTo-Json');
    });

    it('6. Direct UIA property "Name" → buildGetPropertyCommand("Name")', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'App' });
        const result = await getProperty.call(mock, 'Name', 'el-1');
        expect(result).to.equal('App');
        expect(commands[0]).to.contain('NameProperty');
    });

    it('6. Direct UIA property normalizes the first char to uppercase ("name" → "Name")', async () => {
        const { mock, commands } = makeMock({ defaultResponse: 'App' });
        await getProperty.call(mock, 'name', 'el-1');
        expect(commands[0]).to.contain('NameProperty');
    });

    it('6. Direct UIA property falls back to LegacyIAccessible when PS returns empty for "Name"', async () => {
        const { mock, commands } = makeMock({ responses: ['', 'legacy-name'] });
        const result = await getProperty.call(mock, 'Name', 'el-1');
        expect(result).to.equal('legacy-name');
        expect(commands).to.have.length(2);
        expect(commands[1]).to.contain('LegacyIAccessiblePattern');
    });

    it('6. Direct UIA property does NOT fall back for non-mapped properties', async () => {
        // "IsEnabled" has no LEGACY_FALLBACK entry — empty stays empty.
        const { mock, commands } = makeMock({ defaultResponse: '' });
        const result = await getProperty.call(mock, 'IsEnabled', 'el-1');
        expect(result).to.equal('');
        expect(commands).to.have.length(1);
    });

    it('6. "RuntimeId" routes to the direct UIA property path (not the dot-notation path)', async () => {
        const { mock, commands } = makeMock({ defaultResponse: '42.1.2' });
        await getProperty.call(mock, 'RuntimeId', 'el-1');
        expect(commands[0]).to.contain('RuntimeIdProperty');
    });

    it('getAttribute() is a deprecated passthrough to getProperty()', async () => {
        let warned = false;
        const { mock, commands } = makeMock({ defaultResponse: 'v' });
        mock.log.warn = () => { warned = true; };
        // getAttribute delegates via `this.getProperty(...)`, so bind the real
        // impl onto the mock so the lookup finds it.
        mock.getProperty = (propertyName: string, elementId: string) =>
            getProperty.call(mock, propertyName, elementId);
        const result = await getAttribute.call(mock, 'Name', 'el-1');
        expect(result).to.equal('v');
        expect(warned).to.equal(true);
        expect(commands[0]).to.contain('NameProperty');
    });
});

describe('element — setValue (plain text happy path)', () => {
    it('calls SetFocus first, then accumulates chars into a SendKeys command', async () => {
        const { mock, commands } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: true },
        });
        await setValue.call(mock, 'hello', 'el-1');
        // [0] = SetFocus, [1] = SendKeys dispatch (the batched keys).
        expect(commands[0]).to.contain('.SetFocus()');
        const sendKeysCmd = commands.find((c) => c.includes('SendKeys]::SendWait'));
        expect(sendKeysCmd, 'SendKeys command').to.be.a('string');
    });

    it('falls back to ValuePattern.SetValue when SetFocus fails and input is plain ASCII', async () => {
        const { mock, commands } = makeMock({
            throwOnIndex: [0],              // first call (SetFocus) throws
            keyActionSequences: true,
            caps: {},
        });
        await setValue.call(mock, 'hello', 'el-1');
        // [0] = failed SetFocus, [1] = ValuePattern.SetValue fallback.
        expect(commands[1]).to.contain('ValuePattern');
        expect(commands[1]).to.contain('SetValue(');
    });

    it('supports the [delay:NN] prefix to override typeDelay for this call', async () => {
        const { mock, commands } = makeMock({
            keyActionSequences: true,
            caps: { typeDelay: 50, releaseModifierKeys: false },
        });
        // [delay:5] prefix => each char fires its own SendKeys dispatch (typeDelay>0 path).
        await setValue.call(mock, '[delay:5]ab', 'el-1');
        // SetFocus (1) + per-char SendKeys dispatches — the "[delay:5]" itself is stripped.
        const sendKeysCalls = commands.filter((c) => c.includes('SendKeys]::SendWait'));
        // With typeDelay > 0 each char flushes independently (2 chars → 2 dispatches).
        expect(sendKeysCalls.length).to.be.greaterThanOrEqual(2);
        // None of the emitted commands should contain the literal "[delay:5]" marker.
        for (const c of sendKeysCalls) {
            expect(c).to.not.contain('[delay:5]');
        }
    });

    it('escapes SendKeys meta-characters (+^%~())', async () => {
        const { mock, commands } = makeMock({
            keyActionSequences: true,
            caps: {},
        });
        await setValue.call(mock, 'a+b^c', 'el-1');
        const sendKeysCmd = commands.find((c) => c.includes('SendKeys]::SendWait'));
        // The batched string is emitted via PSString, which encodes each char
        // as $([char]0xNNNN). '+' ({ 2b }) gets wrapped in '{' (7b) '}' (7d),
        // producing the sequence 007b then 002b then 007d in PSString form.
        expect(sendKeysCmd!, 'SendKeys command found').to.be.a('string');
        expect(sendKeysCmd!).to.contain('007b'); // '{'
        expect(sendKeysCmd!).to.contain('002b'); // '+'
        expect(sendKeysCmd!).to.contain('007d'); // '}'
        expect(sendKeysCmd!).to.contain('005e'); // '^'
    });

    it('releases held modifiers at end when releaseModifierKeys cap is true', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: true },
        });
        // SHIFT + "A" — no explicit SHIFT release; cap cleanup should emit keyUp.
        await setValue.call(mock, 'A', 'el-1');
        const keyUps = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        expect(keyUps.length).to.be.greaterThanOrEqual(1);
    });

    it('does NOT emit modifier keyUp when releaseModifierKeys cap is false', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        await setValue.call(mock, 'A', 'el-1');
        // Only the keyDown for SHIFT; no trailing keyUp from the cleanup path.
        const keyUps = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        expect(keyUps.length).to.equal(0);
    });

    it('toggling the same modifier twice emits matched keyDown+keyUp (no cleanup needed)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        // Press SHIFT, type 'A', press SHIFT again to release.
        await setValue.call(mock, Key.SHIFT + 'A' + Key.SHIFT, 'el-1');
        const allActions = keySequences.flatMap((s: any) => s.actions);
        expect(allActions.filter((a: any) => a.type === 'keyDown').length).to.equal(1);
        expect(allActions.filter((a: any) => a.type === 'keyUp').length).to.equal(1);
    });

    // Regression: when L_SHIFT is held and R_SHIFT is seen, the code used to
    // release R_SHIFT (the closing char) instead of L_SHIFT (what's actually
    // held). Real held key leaks until the session-end cleanup.
    it('releases the originally-pressed Shift variant, not the closing one (L_SHIFT then R_SHIFT)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        await setValue.call(mock, Key.SHIFT + Key.R_SHIFT, 'el-1');
        const allActions = keySequences.flatMap((s: any) => s.actions);
        const downs = allActions.filter((a: any) => a.type === 'keyDown');
        const ups = allActions.filter((a: any) => a.type === 'keyUp');
        expect(downs.length, 'keyDown count').to.equal(1);
        expect(ups.length, 'keyUp count').to.equal(1);
        expect(downs[0].value).to.equal(Key.SHIFT);
        // The fix: release should match what was originally pressed (Key.SHIFT),
        // not the closing char (Key.R_SHIFT).
        expect(ups[0].value).to.equal(Key.SHIFT);
    });

    it('releases the originally-pressed Control variant (L_CONTROL then R_CONTROL)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        await setValue.call(mock, Key.CONTROL + Key.R_CONTROL, 'el-1');
        const allActions = keySequences.flatMap((s: any) => s.actions);
        const ups = allActions.filter((a: any) => a.type === 'keyUp');
        expect(ups.length).to.equal(1);
        expect(ups[0].value).to.equal(Key.CONTROL);
    });

    it('releases the originally-pressed Alt variant (L_ALT then R_ALT)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        await setValue.call(mock, Key.ALT + Key.R_ALT, 'el-1');
        const ups = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        expect(ups.length).to.equal(1);
        expect(ups[0].value).to.equal(Key.ALT);
    });

    it('releases the originally-pressed Meta variant (L_META then R_META)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            caps: { releaseModifierKeys: false },
        });
        await setValue.call(mock, Key.META + Key.R_META, 'el-1');
        const ups = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        expect(ups.length).to.equal(1);
        expect(ups[0].value).to.equal(Key.META);
    });

    // Regression: the cleanup block used to live outside a try/finally, so if
    // an inner sendPowerShellCommand threw mid-loop, modifiers were leaked.
    it('releases held modifiers in a finally block when an inner PS call throws', async () => {
        // Commands sequence: [SetFocus (0), SendWait (1)].
        // Throw on SendWait so the per-char flush after the 'a' char fails.
        // The SHIFT was pressed before the flush; its release lives in the
        // finally block and must still run.
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            throwOnIndex: [1],
            caps: { releaseModifierKeys: true },
        });
        try {
            await setValue.call(mock, Key.SHIFT + 'a', 'el-1');
            expect.fail('should have re-thrown the inner PS error');
        } catch {
            // Expected — inner SendKeys throw is propagated.
        }
        const ups = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        // The finally block must have emitted the SHIFT keyUp even though
        // the flush threw.
        expect(ups.length).to.be.greaterThanOrEqual(1);
        expect(ups[0].value).to.equal(Key.SHIFT);
    });

    it('does NOT release modifiers in finally when releaseModifierKeys cap is false (even on error)', async () => {
        const { mock, keySequences } = makeMock({
            keyActionSequences: true,
            throwOnIndex: [1],
            caps: { releaseModifierKeys: false },
        });
        try {
            await setValue.call(mock, Key.SHIFT + 'a', 'el-1');
            expect.fail('should have re-thrown');
        } catch {
            // Expected.
        }
        const ups = keySequences.flatMap((s: any) => s.actions).filter((a: any) => a.type === 'keyUp');
        expect(ups.length).to.equal(0);
    });
});
