import { expect } from 'chai';
import { W3C_ELEMENT_KEY } from '@appium/base-driver';
import {
    handleKeyActionSequence,
    handleMouseMoveAction,
    handleNullActionSequence,
    handleMousePointerActionSequence,
    handlePointerActionSequence,
    handleWheelActionSequence,
    performActions,
} from '../../lib/commands/actions';
import { decodePwsh } from '../../lib/powershell/core';

// W3C action dispatch tests.
//
// The "leaf" handlers (handleKeyAction, handleMouseMoveAction, and the
// pointerDown/pointerUp branches of handleMousePointerActionSequence, etc.)
// all call into lib/winapi/user32 — which on the happy path triggers real
// SendInput calls. Those are unsafe in unit tests (they'd actually press
// keys or move the cursor).
//
// We therefore test only:
//   * `performActions` top-level dispatch via mocked child handlers
//   * `pause` branches (no native I/O)
//   * error branches (invalid action types)
//   * `handleKeyActionSequence` loop (with mocked handleKeyAction)
//   * `handleNullActionSequence` (loops + sleeps)

function makeMock() {
    const calls: Record<string, any[][]> = {
        handleKeyActionSequence: [],
        handleWheelActionSequence: [],
        handlePointerActionSequence: [],
        handleNullActionSequence: [],
        handleMouseMoveAction: [],
        handleMousePointerActionSequence: [],
        handleKeyAction: [],
    };
    const mock: any = {
        caps: {},
        keyboardState: { pressed: new Set<string>(), shift: false, ctrl: false, meta: false, alt: false },
        log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
    };
    for (const name of Object.keys(calls)) {
        mock[name] = async (...args: any[]) => { calls[name].push(args); };
    }
    return { mock, calls };
}

describe('actions — performActions dispatch', () => {
    it('routes `key` sequences to handleKeyActionSequence', async () => {
        const { mock, calls } = makeMock();
        await performActions.call(mock, [
            { type: 'key', id: 'k', actions: [{ type: 'pause', duration: 0 } as any] },
        ] as any);
        expect(calls.handleKeyActionSequence).to.have.length(1);
    });

    it('routes `wheel` sequences to handleWheelActionSequence', async () => {
        const { mock, calls } = makeMock();
        await performActions.call(mock, [
            { type: 'wheel', id: 'w', actions: [] },
        ] as any);
        expect(calls.handleWheelActionSequence).to.have.length(1);
    });

    it('routes `pointer` sequences to handlePointerActionSequence', async () => {
        const { mock, calls } = makeMock();
        await performActions.call(mock, [
            { type: 'pointer', id: 'p', actions: [], parameters: { pointerType: 'mouse' } },
        ] as any);
        expect(calls.handlePointerActionSequence).to.have.length(1);
    });

    it('routes `none` sequences to handleNullActionSequence', async () => {
        const { mock, calls } = makeMock();
        await performActions.call(mock, [
            { type: 'none', id: 'n', actions: [] },
        ] as any);
        expect(calls.handleNullActionSequence).to.have.length(1);
    });

    it('processes multiple sequences in order', async () => {
        const { mock, calls } = makeMock();
        await performActions.call(mock, [
            { type: 'none', id: 'n', actions: [] },
            { type: 'key', id: 'k', actions: [] },
            { type: 'wheel', id: 'w', actions: [] },
        ] as any);
        expect(calls.handleNullActionSequence).to.have.length(1);
        expect(calls.handleKeyActionSequence).to.have.length(1);
        expect(calls.handleWheelActionSequence).to.have.length(1);
    });

    it('rejects an unsupported action-sequence type', async () => {
        const { mock } = makeMock();
        try {
            await performActions.call(mock, [{ type: 'bogus' as any, id: 'b', actions: [] } as any]);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('actions — handlePointerActionSequence', () => {
    it('routes pointerType=mouse to handleMousePointerActionSequence', async () => {
        const { mock, calls } = makeMock();
        await handlePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [],
            parameters: { pointerType: 'mouse' },
        } as any);
        expect(calls.handleMousePointerActionSequence).to.have.length(1);
    });

    it('routes pointerType=touch to handleMousePointerActionSequence (fallback)', async () => {
        const { mock, calls } = makeMock();
        await handlePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [],
            parameters: { pointerType: 'touch' },
        } as any);
        expect(calls.handleMousePointerActionSequence).to.have.length(1);
    });

    it('routes pointerType=pen to handleMousePointerActionSequence (fallback)', async () => {
        const { mock, calls } = makeMock();
        await handlePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [],
            parameters: { pointerType: 'pen' },
        } as any);
        expect(calls.handleMousePointerActionSequence).to.have.length(1);
    });

    it('defaults missing pointerType to the mouse branch', async () => {
        const { mock, calls } = makeMock();
        await handlePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [],
        } as any);
        expect(calls.handleMousePointerActionSequence).to.have.length(1);
    });
});

describe('actions — handleMousePointerActionSequence (safe branches only)', () => {
    it('handles pause action with zero duration', async () => {
        const { mock } = makeMock();
        // Note: this bypasses the mocked handleMouseMoveAction by using only 'pause'.
        await handleMousePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [{ type: 'pause', duration: 0 } as any],
        } as any);
    });

    it('handles pause with a small duration without errors', async () => {
        const { mock } = makeMock();
        const start = Date.now();
        await handleMousePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [{ type: 'pause', duration: 10 } as any],
        } as any);
        // Allow a little slack, but should not hang.
        expect(Date.now() - start).to.be.lessThan(500);
    });

    it('routes pointerMove to handleMouseMoveAction', async () => {
        const { mock, calls } = makeMock();
        await handleMousePointerActionSequence.call(mock, {
            type: 'pointer',
            id: 'p',
            actions: [{ type: 'pointerMove', x: 10, y: 20, duration: 0 } as any],
        } as any);
        expect(calls.handleMouseMoveAction).to.have.length(1);
    });

    it('throws on unsupported action type', async () => {
        const { mock } = makeMock();
        try {
            await handleMousePointerActionSequence.call(mock, {
                type: 'pointer',
                id: 'p',
                actions: [{ type: 'bogus' } as any],
            } as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('actions — handleWheelActionSequence', () => {
    it('handles pause without error', async () => {
        const { mock } = makeMock();
        await handleWheelActionSequence.call(mock, {
            type: 'wheel',
            id: 'w',
            actions: [{ type: 'pause', duration: 0 } as any],
        } as any);
    });

    it('throws on unsupported action type', async () => {
        const { mock } = makeMock();
        try {
            await handleWheelActionSequence.call(mock, {
                type: 'wheel',
                id: 'w',
                actions: [{ type: 'bogus' } as any],
            } as any);
            expect.fail('should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidArgumentError');
        }
    });
});

describe('actions — handleMouseMoveAction element origin + scrollIntoView re-query', () => {
    // Regression guard for a bug where, after scrolling an off-screen element
    // back into view, the code re-parsed the *old* JSON instead of re-querying
    // the rect. Left the mouse moving to the stale off-screen coords.

    it('re-queries the element rect after scrollIntoView when initial rect is off-screen', async () => {
        const psCommands: string[] = [];
        let callIdx = 0;
        const mock: any = {
            caps: {},
            log: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} },
            sendPowerShellCommand: async (cmd: string): Promise<string> => {
                psCommands.push(decodePwsh(cmd));
                const i = callIdx++;
                if (i === 0) {
                    // Initial rect — all four fields are the Infinity sentinel (off-screen).
                    return '{"x":Infinity,"y":Infinity,"width":Infinity,"height":Infinity}';
                }
                if (i === 1) {
                    // scrollIntoView call — no response needed.
                    return '';
                }
                // The third call is the re-query we want to verify happens.
                // Throw here to short-circuit before the native mouseMoveAbsolute call.
                throw new Error('stop-before-native');
            },
        };

        try {
            await handleMouseMoveAction.call(mock, {
                type: 'pointerMove',
                origin: { [W3C_ELEMENT_KEY]: 'some-el' } as any,
                x: 0, y: 0, duration: 0,
            } as any);
            expect.fail('should have thrown before calling mouseMoveAbsolute');
        } catch (e: any) {
            expect(e.message).to.equal('stop-before-native');
        }

        // Exactly three PS calls: initial rect, scrollIntoView, re-queried rect.
        expect(psCommands).to.have.length(3);
        // Calls 0 and 2 are both rect queries (same command shape).
        expect(psCommands[0]).to.contain('BoundingRectangle');
        expect(psCommands[2]).to.contain('BoundingRectangle');
        // Call 1 is scrollIntoView.
        expect(psCommands[1]).to.contain('ScrollItemPattern');
    });
});

describe('actions — handleKeyActionSequence (loop dispatch)', () => {
    it('calls handleKeyAction once per action in the sequence', async () => {
        const { mock, calls } = makeMock();
        await handleKeyActionSequence.call(mock, {
            type: 'key',
            id: 'k',
            actions: [
                { type: 'pause', duration: 0 } as any,
                { type: 'pause', duration: 0 } as any,
                { type: 'pause', duration: 0 } as any,
            ],
        } as any);
        expect(calls.handleKeyAction).to.have.length(3);
    });

    it('no-op when actions array is empty', async () => {
        const { mock, calls } = makeMock();
        await handleKeyActionSequence.call(mock, {
            type: 'key',
            id: 'k',
            actions: [],
        } as any);
        expect(calls.handleKeyAction).to.have.length(0);
    });
});

describe('actions — handleNullActionSequence', () => {
    it('no-ops on an empty actions array', async () => {
        const { mock } = makeMock();
        const start = Date.now();
        await handleNullActionSequence.call(mock, {
            type: 'none',
            id: 'n',
            actions: [],
        } as any);
        expect(Date.now() - start).to.be.lessThan(50);
    });

    it('sleeps for each action with a duration', async () => {
        const { mock } = makeMock();
        const start = Date.now();
        await handleNullActionSequence.call(mock, {
            type: 'none',
            id: 'n',
            actions: [
                { duration: 20 } as any,
                { duration: 20 } as any,
            ],
        } as any);
        // Two 20ms sleeps in series = ~40ms minimum. Generous upper bound for CI.
        expect(Date.now() - start).to.be.greaterThanOrEqual(30);
        expect(Date.now() - start).to.be.lessThan(1000);
    });

    it('ignores actions without a duration', async () => {
        const { mock } = makeMock();
        const start = Date.now();
        await handleNullActionSequence.call(mock, {
            type: 'none',
            id: 'n',
            actions: [{ } as any, { duration: 0 } as any],
        } as any);
        expect(Date.now() - start).to.be.lessThan(50);
    });
});
