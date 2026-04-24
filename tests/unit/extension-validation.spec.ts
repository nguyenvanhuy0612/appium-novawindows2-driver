import { expect } from 'chai';
import {
    executeClick,
    executeClickAndDrag,
    executeHover,
    executeKeys,
    executeScroll,
    activateProcess,
    patternScrollIntoView,
} from '../../lib/commands/extension';

// Argument-validation error paths for extension commands that otherwise
// call into native user32.dll (mouse / keyboard input). We only exercise
// the branches that throw BEFORE touching native I/O, to keep the test
// suite safe and deterministic.

function makeMock(caps: any = {}) {
    const mock: any = {
        caps,
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
        sendPowerShellCommand: async () => '',
    };
    return mock;
}

describe('extension — coord-pair validation', () => {
    describe('executeClick', () => {
        it('throws when only x is provided without y', async () => {
            const mock = makeMock();
            try {
                await executeClick.call(mock, { x: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
                expect(e.message).to.match(/Both x and y/i);
            }
        });

        it('throws when only y is provided without x', async () => {
            const mock = makeMock();
            try {
                await executeClick.call(mock, { y: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });

    describe('executeHover', () => {
        it('throws when only startX is provided without startY', async () => {
            const mock = makeMock();
            try {
                await executeHover.call(mock, { startX: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
                expect(e.message).to.match(/startX and startY/i);
            }
        });

        it('throws when only startY is provided without startX', async () => {
            const mock = makeMock();
            try {
                await executeHover.call(mock, { startY: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });

    describe('executeScroll', () => {
        it('throws when only x is provided without y', async () => {
            const mock = makeMock();
            try {
                await executeScroll.call(mock, { x: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });

        it('throws when only y is provided without x', async () => {
            const mock = makeMock();
            try {
                await executeScroll.call(mock, { y: 10 });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
            }
        });
    });

    describe('executeClickAndDrag', () => {
        it('throws when only startX is provided without startY', async () => {
            const mock = makeMock();
            try {
                await executeClickAndDrag.call(mock, { startX: 10 } as any);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
                expect(e.message).to.match(/startX and startY/i);
            }
        });

        it('throws when only endY is provided without endX', async () => {
            const mock = makeMock();
            try {
                await executeClickAndDrag.call(mock, {
                    startElementId: 'start',
                    endY: 50,
                } as any);
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
                expect(e.message).to.match(/endX and endY/i);
            }
        });

        it('throws on an invalid button name', async () => {
            const mock = makeMock();
            try {
                await executeClickAndDrag.call(mock, {
                    startElementId: 'start',
                    endElementId: 'end',
                    button: 'bogus-button' as any,
                });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.name).to.equal('InvalidArgumentError');
                expect(e.message).to.match(/Invalid button/i);
            }
        });
    });
});

describe('extension — executeKeys validation', () => {
    it('rejects an action with none of pause/text/virtualKeyCode', async () => {
        const mock = makeMock();
        try {
            await executeKeys.call(mock, {
                actions: [{} as any],
                forceUnicode: false,
            });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
            expect(e.message).to.match(/pause, text or virtualKeyCode/i);
        }
    });

    it('rejects an action with BOTH text and virtualKeyCode', async () => {
        const mock = makeMock();
        try {
            await executeKeys.call(mock, {
                actions: [{ text: 'a', virtualKeyCode: 0x41 } as any],
                forceUnicode: false,
            });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('normalises a single-action object to a one-element array', async () => {
        // The validation check requires EXACTLY one of pause/text/virtualKeyCode
        // to be truthy, so we use pause: 1 (a 1ms sleep, no native input).
        const mock = makeMock();
        const start = Date.now();
        await executeKeys.call(mock, {
            actions: { pause: 1 } as any,
            forceUnicode: false,
        });
        expect(Date.now() - start).to.be.lessThan(500);
    });

    it('processes an empty actions array without error', async () => {
        const mock = makeMock();
        await executeKeys.call(mock, { actions: [], forceUnicode: false });
    });
});

describe('extension — activateProcess validation', () => {
    it('rejects null args', async () => {
        const mock = makeMock();
        try {
            await activateProcess.call(mock, null as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
            expect(e.message).to.match(/'process' must be provided/);
        }
    });

    it('rejects args without a "process" field', async () => {
        const mock = makeMock();
        try {
            await activateProcess.call(mock, {} as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });

    it('rejects a string (non-object) arg', async () => {
        const mock = makeMock();
        try {
            await activateProcess.call(mock, 'notepad' as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('extension — patternScrollIntoView validation', () => {
    it('throws when the element argument has no W3C element id', async () => {
        const mock = makeMock();
        try {
            await patternScrollIntoView.call(mock, {} as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
            expect(e.message).to.match(/Element ID is required/i);
        }
    });
});

describe('extension — ensureElementResolved (via executeClick) case-insensitive $null check', () => {
    // Regression: the `$null -eq` PS response used to be compared as === 'True'
    // (strict case), which would break if PS ever returned 'true'/'TRUE'. Now
    // the comparison is `.toLowerCase() === 'true'`.
    it('treats PS response "true" (lowercase) as null-match → RUNTIME_ID fallback', async () => {
        const commands: string[] = [];
        let call = 0;
        const mock: any = {
            caps: {},
            log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            sendPowerShellCommand: async (cmd: string): Promise<string> => {
                commands.push(cmd);
                if (call++ === 0) return 'true';  // lowercase null-match
                // Second call is the RUNTIME_ID fallback lookup — return empty to
                // short-circuit into NoSuchElementError.
                return '';
            },
        };
        try {
            await executeClick.call(mock, { elementId: '1.2.3' });
            expect.fail('should have thrown NoSuchElementError');
        } catch (e: any) {
            expect(e.name).to.equal('NoSuchElementError');
        }
        // Two PS calls: the null-check and the RUNTIME_ID fallback.
        expect(commands).to.have.length(2);
    });

    it('treats PS response "TRUE" (uppercase) as null-match too', async () => {
        let call = 0;
        const mock: any = {
            caps: {},
            log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            sendPowerShellCommand: async (): Promise<string> => {
                if (call++ === 0) return 'TRUE';
                return '';
            },
        };
        try {
            await executeClick.call(mock, { elementId: '1.2.3' });
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('NoSuchElementError');
        }
    });
});
