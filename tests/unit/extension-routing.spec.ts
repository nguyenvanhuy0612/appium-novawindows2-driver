import { expect } from 'chai';
import { execute } from '../../lib/commands/extension';
import { POWER_SHELL_FEATURE } from '../../lib/constants';

// `execute(script, args)` is the driver's entry point for `executeScript()`.
// It routes four categories of inputs:
//   1. `windows: <name>`                         -> EXTENSION_COMMANDS[<name>]
//   2. `powershell` (case-insensitive)           -> executePowerShellScript
//   3. Specific magic strings (pullFile, etc.)   -> pullFile/pushFile/pullFolder
//   4. `return window.name`                      -> root window NAME property
//   5. `arguments[0].scrollIntoView()` (WD shim) -> patternScrollIntoView
// Anything else throws NotImplementedError.

function makeMock(methods: string[]) {
    const calls: Record<string, any[][]> = {};
    const mock: any = {
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        featuresEnabled: [] as string[],
        assertFeatureEnabled(feature: string) {
            if (!this.featuresEnabled.includes(feature)) {
                const err: any = new Error(`feature ${feature} is not enabled`);
                err.name = 'NotImplementedError';
                throw err;
            }
        },
    };
    for (const name of methods) {
        calls[name] = [];
        mock[name] = async (...args: any[]) => {
            calls[name].push(args);
            return `${name}-result`;
        };
    }
    return { mock, calls };
}

// The full list of `windows:` commands that should route through EXTENSION_COMMANDS.
const EXTENSION_ROUTES: Array<[script: string, method: string]> = [
    ['windows: cacheRequest',         'pushCacheRequest'],
    ['windows: invoke',               'patternInvoke'],
    ['windows: expand',               'patternExpand'],
    ['windows: collapse',             'patternCollapse'],
    ['windows: isMultiple',           'patternIsMultiple'],
    ['windows: scrollIntoView',       'patternScrollIntoView'],
    ['windows: selectedItem',         'patternGetSelectedItem'],
    ['windows: allSelectedItems',     'patternGetAllSelectedItems'],
    ['windows: addToSelection',       'patternAddToSelection'],
    ['windows: removeFromSelection',  'patternRemoveFromSelection'],
    ['windows: select',               'patternSelect'],
    ['windows: toggle',               'patternToggle'],
    ['windows: setValue',             'patternSetValue'],
    ['windows: getValue',             'patternGetValue'],
    ['windows: maximize',             'patternMaximize'],
    ['windows: minimize',             'patternMinimize'],
    ['windows: restore',              'patternRestore'],
    ['windows: close',                'patternClose'],
    ['windows: keys',                 'executeKeys'],
    ['windows: click',                'executeClick'],
    ['windows: hover',                'executeHover'],
    ['windows: scroll',               'executeScroll'],
    ['windows: setFocus',             'focusElement'],
    ['windows: getClipboard',         'getClipboardBase64'],
    ['windows: setClipboard',         'setClipboardFromBase64'],
    ['windows: setProcessForeground', 'activateProcess'],
    ['windows: getAttributes',        'getAttributes'],
    ['windows: typeDelay',            'typeDelay'],
    ['windows: clickAndDrag',         'executeClickAndDrag'],
    ['windows: startRecordingScreen', 'startRecordingScreen'],
    ['windows: stopRecordingScreen',  'stopRecordingScreen'],
    ['windows: launchApp',            'launchApp'],
    ['windows: closeApp',             'closeApp'],
];

describe('extension routing — windows: prefix (full map)', () => {
    for (const [script, method] of EXTENSION_ROUTES) {
        it(`"${script}" → ${method}()`, async () => {
            const { mock, calls } = makeMock([method]);
            const result = await execute.call(mock, script, []);
            expect(calls[method], `${method} invocations`).to.have.length(1);
            expect(result).to.equal(`${method}-result`);
        });
    }

    it('rejects unknown "windows: foo" commands with UnknownCommandError', async () => {
        const { mock } = makeMock([]);
        try {
            await execute.call(mock, 'windows: notARealCommand', []);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('UnknownCommandError');
        }
    });

    it('forwards positional args to the target method', async () => {
        const { mock, calls } = makeMock(['launchApp']);
        await execute.call(mock, 'windows: launchApp', ['arg-a', { k: 1 }]);
        expect(calls.launchApp[0]).to.deep.equal(['arg-a', { k: 1 }]);
    });
});

describe('extension routing — non-windows: paths', () => {
    describe('powershell (executePowerShellScript)', () => {
        it('routes "powershell" (lowercase) to executePowerShellScript', async () => {
            const { mock, calls } = makeMock(['executePowerShellScript']);
            mock.featuresEnabled = [POWER_SHELL_FEATURE];
            await execute.call(mock, 'powershell', [{ command: 'Get-Date' }]);
            expect(calls.executePowerShellScript).to.have.length(1);
            expect(calls.executePowerShellScript[0][0]).to.deep.equal({ command: 'Get-Date' });
        });

        it('routes "PowerShell" (case-insensitive) to executePowerShellScript', async () => {
            const { mock, calls } = makeMock(['executePowerShellScript']);
            mock.featuresEnabled = [POWER_SHELL_FEATURE];
            await execute.call(mock, 'PowerShell', [{ script: 'foo' }]);
            expect(calls.executePowerShellScript).to.have.length(1);
        });

        it('substitutes empty args with {} to avoid undefined deref', async () => {
            const { mock, calls } = makeMock(['executePowerShellScript']);
            mock.featuresEnabled = [POWER_SHELL_FEATURE];
            await execute.call(mock, 'powershell', []);
            expect(calls.executePowerShellScript[0][0]).to.deep.equal({});
        });

        it('rejects when power_shell feature is NOT enabled', async () => {
            const { mock, calls } = makeMock(['executePowerShellScript']);
            // Note: featuresEnabled is empty by default.
            try {
                await execute.call(mock, 'powershell', [{ command: 'X' }]);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NotImplementedError');
            }
            expect(calls.executePowerShellScript).to.have.length(0);
        });
    });

    it('routes "return window.name" to sendPowerShellCommand(NAME query)', async () => {
        const commands: string[] = [];
        const mock: any = {
            log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            assertFeatureEnabled: () => {},
            sendPowerShellCommand: async (cmd: string) => {
                commands.push(cmd);
                return 'Calculator';
            },
        };
        const result = await execute.call(mock, 'return window.name', []);
        expect(result).to.equal('Calculator');
        expect(commands).to.have.length(1);
    });

    it('routes "pullFile" to pullFile with { path }', async () => {
        const { mock, calls } = makeMock(['pullFile']);
        await execute.call(mock, 'pullFile', [{ path: 'C:\\temp\\x.txt' }]);
        expect(calls.pullFile).to.have.length(1);
        expect(calls.pullFile[0]).to.deep.equal(['C:\\temp\\x.txt']);
    });

    it('routes "pushFile" to pushFile with { path, data }', async () => {
        const { mock, calls } = makeMock(['pushFile']);
        await execute.call(mock, 'pushFile', [{ path: 'C:\\out\\y.bin', data: 'SGVsbG8=' }]);
        expect(calls.pushFile).to.have.length(1);
        expect(calls.pushFile[0]).to.deep.equal(['C:\\out\\y.bin', 'SGVsbG8=']);
    });

    it('routes "pullFolder" to pullFolder with { path }', async () => {
        const { mock, calls } = makeMock(['pullFolder']);
        await execute.call(mock, 'pullFolder', [{ path: 'C:\\some\\dir' }]);
        expect(calls.pullFolder).to.have.length(1);
        expect(calls.pullFolder[0]).to.deep.equal(['C:\\some\\dir']);
    });

    describe('arguments[0].scrollIntoView() shim', () => {
        it('routes the Selenium JS shim to patternScrollIntoView', async () => {
            const { mock, calls } = makeMock(['patternScrollIntoView']);
            await execute.call(mock, 'arguments[0].scrollIntoView()', [{ some: 'el' }]);
            expect(calls.patternScrollIntoView).to.have.length(1);
            expect(calls.patternScrollIntoView[0][0]).to.deep.equal({ some: 'el' });
        });

        it('rejects when the first arg is not an element-shaped object', async () => {
            const { mock } = makeMock(['patternScrollIntoView']);
            try {
                await execute.call(mock, 'arguments[0].scrollIntoView()', ['a-string' as any]);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });

    it('throws NotImplementedError for an unhandled script', async () => {
        const { mock } = makeMock([]);
        try {
            await execute.call(mock, 'somethingElse', []);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('NotImplementedError');
        }
    });
});
