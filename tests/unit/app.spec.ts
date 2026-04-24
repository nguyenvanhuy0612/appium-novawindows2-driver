import { expect } from 'chai';
import {
    title,
    maximizeWindow,
    minimizeWindow,
    back,
    forward,
    closeApp,
    launchApp,
    setWindowRect,
} from '../../lib/commands/app';
import { decodePwsh } from '../../lib/powershell/core';

// Discriminates getRootElementId's PS call by `$rootElement` + `RuntimeIdProperty`.

interface MockOpts {
    rootId?: string | null;
    caps?: any;
    titleReturn?: string;
    windowRectReturn?: any;
}

function makeMock(opts: MockOpts = {}) {
    const commands: string[] = [];
    const mock: any = {
        caps: opts.caps ?? {},
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        sendPowerShellCommand: async (cmd: string): Promise<string> => {
            const decoded = decodePwsh(cmd);
            commands.push(decoded);

            // Root element id resolution (getRootElementId helper).
            if (decoded.includes('$rootElement') && decoded.includes('RuntimeIdProperty')) {
                return opts.rootId === undefined ? 'root-42' : (opts.rootId ?? '');
            }
            // Name property read (title()).
            if (/nameProperty/i.test(decoded)) {
                return opts.titleReturn ?? 'Test Window';
            }
            return '';
        },
        getWindowRect: async () => opts.windowRectReturn ?? { x: 1, y: 2, width: 3, height: 4 },
        changeRootCalls: [] as any[],
        changeRootElement: async function (path: any): Promise<void> {
            (this.changeRootCalls as any[]).push(path);
        },
    };
    return { mock, commands };
}

function decodedCall(commands: string[], predicate: (s: string) => boolean): string | undefined {
    return commands.find(predicate);
}

describe('app commands — W3C window/navigation surface', () => {
    describe('title()', () => {
        it('returns the Name property of the root window', async () => {
            const { mock } = makeMock({ titleReturn: 'Calculator' });
            const result = await title.call(mock);
            expect(result).to.equal('Calculator');
        });

        it('issues a root-id query and a NAME property read', async () => {
            const { mock, commands } = makeMock({ titleReturn: 'Notepad' });
            await title.call(mock);
            expect(commands.some((c) => c.includes('RuntimeIdProperty'))).to.equal(true);
            expect(commands.some((c) => /nameProperty/i.test(c))).to.equal(true);
        });

        it('throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await title.call(mock);
                expect.fail('title() should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });
    });

    describe('maximizeWindow()', () => {
        it('invokes WindowPattern.SetWindowVisualState(Maximized) on the root element', async () => {
            const { mock, commands } = makeMock();
            await maximizeWindow.call(mock);
            const maxCmd = decodedCall(commands, (c) => c.includes('SetWindowVisualState'));
            expect(maxCmd, 'maximize command').to.be.a('string');
            expect(maxCmd!).to.contain('[WindowPattern]::Pattern');
            expect(maxCmd!).to.contain('Maximized');
        });

        it('embeds the resolved root element id into the PS command', async () => {
            const { mock, commands } = makeMock({ rootId: 'win-abc' });
            await maximizeWindow.call(mock);
            const maxCmd = decodedCall(commands, (c) => c.includes('SetWindowVisualState'));
            expect(maxCmd!).to.contain("'win-abc'");
        });

        it('throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await maximizeWindow.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });
    });

    describe('minimizeWindow()', () => {
        it('invokes WindowPattern.SetWindowVisualState(Minimized) on the root element', async () => {
            const { mock, commands } = makeMock();
            await minimizeWindow.call(mock);
            const minCmd = decodedCall(commands, (c) => c.includes('SetWindowVisualState'));
            expect(minCmd!).to.contain('[WindowPattern]::Pattern');
            expect(minCmd!).to.contain('Minimized');
        });

        it('throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await minimizeWindow.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });
    });

    // Note: the happy path of back()/forward() issues real SendInput calls via
    // koffi → user32.dll, which would press keys on the test runner's machine.
    // We only cover the no-root error path to avoid side effects.
    describe('back() / forward() — no-root guard', () => {
        it('back() throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await back.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });

        it('forward() throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await forward.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });
    });

    describe('closeApp()', () => {
        it('issues Close and then nulls $rootElement', async () => {
            const { mock, commands } = makeMock();
            await closeApp.call(mock);
            expect(commands.some((c) => c.includes('Close()'))).to.equal(true);
            expect(commands.some((c) => c.includes('$rootElement = $null'))).to.equal(true);
        });

        it('sends the Close command after the root-id query', async () => {
            const { mock, commands } = makeMock();
            await closeApp.call(mock);
            const idxRoot = commands.findIndex((c) => c.includes('RuntimeIdProperty'));
            const idxClose = commands.findIndex((c) => c.includes('Close()'));
            expect(idxRoot).to.be.lessThan(idxClose);
        });

        it('throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await closeApp.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });
    });

    describe('launchApp()', () => {
        it('throws InvalidArgumentError when caps.app is undefined', async () => {
            const { mock } = makeMock({ caps: {} });
            try {
                await launchApp.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('throws InvalidArgumentError when caps.app is "root"', async () => {
            const { mock } = makeMock({ caps: { app: 'root' } });
            try {
                await launchApp.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('throws InvalidArgumentError when caps.app is "none"', async () => {
            const { mock } = makeMock({ caps: { app: 'none' } });
            try {
                await launchApp.call(mock);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('is case-insensitive for "Root" / "NONE"', async () => {
            for (const sentinel of ['Root', 'ROOT', 'None', 'NONE']) {
                const { mock } = makeMock({ caps: { app: sentinel } });
                try {
                    await launchApp.call(mock);
                    expect.fail(`should have thrown for app=${sentinel}`);
                } catch (e: any) {
                    expect(e.name).to.equal('InvalidArgumentError');
                }
            }
        });

        it('delegates to changeRootElement with the configured app path', async () => {
            const { mock } = makeMock({ caps: { app: 'C:\\Windows\\System32\\notepad.exe' } });
            await launchApp.call(mock);
            expect(mock.changeRootCalls).to.deep.equal(['C:\\Windows\\System32\\notepad.exe']);
        });
    });

    describe('setWindowRect()', () => {
        it('throws InvalidArgumentError on negative width', async () => {
            const { mock } = makeMock();
            try {
                await setWindowRect.call(mock, 0, 0, -1, 100);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('throws InvalidArgumentError on negative height', async () => {
            const { mock } = makeMock();
            try {
                await setWindowRect.call(mock, 0, 0, 100, -1);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('throws NoSuchWindowError when no root window is attached', async () => {
            const { mock } = makeMock({ rootId: null });
            try {
                await setWindowRect.call(mock, 10, 20, 30, 40);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('NoSuchWindowError');
            }
        });

        it('issues only a Move when width/height are both null', async () => {
            const { mock, commands } = makeMock();
            await setWindowRect.call(mock, 100, 200, null, null);
            const moves = commands.filter((c) => c.includes('.Move('));
            const resizes = commands.filter((c) => c.includes('.Resize('));
            expect(moves).to.have.length(1);
            expect(resizes).to.have.length(0);
            expect(moves[0]).to.contain('.Move(100, 200)');
        });

        it('issues only a Resize when x/y are both null', async () => {
            const { mock, commands } = makeMock();
            await setWindowRect.call(mock, null, null, 800, 600);
            const moves = commands.filter((c) => c.includes('.Move('));
            const resizes = commands.filter((c) => c.includes('.Resize('));
            expect(moves).to.have.length(0);
            expect(resizes).to.have.length(1);
            expect(resizes[0]).to.contain('.Resize(800, 600)');
        });

        it('issues both Move and Resize when all four args are provided', async () => {
            const { mock, commands } = makeMock();
            await setWindowRect.call(mock, 10, 20, 300, 400);
            expect(commands.some((c) => c.includes('.Move(10, 20)'))).to.equal(true);
            expect(commands.some((c) => c.includes('.Resize(300, 400)'))).to.equal(true);
        });

        it('Move is issued before Resize in the happy path', async () => {
            const { mock, commands } = makeMock();
            await setWindowRect.call(mock, 10, 20, 300, 400);
            const idxMove = commands.findIndex((c) => c.includes('.Move('));
            const idxResize = commands.findIndex((c) => c.includes('.Resize('));
            expect(idxMove).to.be.lessThan(idxResize);
        });

        it('returns the result of getWindowRect after the mutation', async () => {
            const expected = { x: 100, y: 200, width: 800, height: 600 };
            const { mock } = makeMock({ windowRectReturn: expected });
            const result = await setWindowRect.call(mock, 100, 200, 800, 600);
            expect(result).to.deep.equal(expected);
        });

        it('does not send any Move/Resize PS commands when all four args are null', async () => {
            const { mock, commands } = makeMock();
            await setWindowRect.call(mock, null, null, null, null);
            const moves = commands.filter((c) => c.includes('.Move('));
            const resizes = commands.filter((c) => c.includes('.Resize('));
            expect(moves).to.have.length(0);
            expect(resizes).to.have.length(0);
        });
    });
});
