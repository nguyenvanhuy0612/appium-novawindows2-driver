import { expect } from 'chai';
import {
    $,
    DeferredStringTemplate,
    assertSupportedEasingFunction,
    getBundledFfmpegPath,
    sleep,
} from '../../lib/util';

describe('util', () => {
    describe('assertSupportedEasingFunction', () => {
        const named = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out'];

        for (const name of named) {
            it(`accepts named easing "${name}"`, () => {
                expect(() => assertSupportedEasingFunction(name)).to.not.throw();
            });
        }

        it('accepts a well-formed cubic-bezier(...)', () => {
            expect(() => assertSupportedEasingFunction('cubic-bezier(0.1, 0.2, 0.3, 0.4)')).to.not.throw();
        });

        it('accepts cubic-bezier with integer args (0 and 1)', () => {
            expect(() => assertSupportedEasingFunction('cubic-bezier(0, 0, 1, 1)')).to.not.throw();
        });

        it('accepts cubic-bezier with negative y values (overshoot)', () => {
            expect(() => assertSupportedEasingFunction('cubic-bezier(0.68, -0.55, 0.27, 1.55)')).to.not.throw();
        });

        it('rejects unknown named easing', () => {
            expect(() => assertSupportedEasingFunction('ease-banana')).to.throw(/Unsupported or invalid/);
        });

        it('rejects malformed cubic-bezier (wrong number of args)', () => {
            expect(() => assertSupportedEasingFunction('cubic-bezier(0.1, 0.2, 0.3)')).to.throw(/Unsupported or invalid/);
        });

        it('rejects cubic-bezier with empty body', () => {
            expect(() => assertSupportedEasingFunction('cubic-bezier()')).to.throw(/Unsupported or invalid/);
        });

        it('rejects empty string', () => {
            expect(() => assertSupportedEasingFunction('')).to.throw(/Unsupported or invalid/);
        });
    });

    describe('sleep', () => {
        it('resolves after roughly the requested ms', async () => {
            const start = Date.now();
            await sleep(50);
            const elapsed = Date.now() - start;
            // Allow a generous window to avoid flakiness in CI.
            expect(elapsed).to.be.greaterThanOrEqual(40);
            expect(elapsed).to.be.lessThan(500);
        });

        it('clamps negative values to zero (does not hang)', async () => {
            const start = Date.now();
            await sleep(-100);
            const elapsed = Date.now() - start;
            expect(elapsed).to.be.lessThan(50);
        });

        it('handles zero immediately', async () => {
            await sleep(0);
        });
    });

    describe('$ tagged template + DeferredStringTemplate', () => {
        it('returns a DeferredStringTemplate instance', () => {
            const t = $`hello ${0}`;
            expect(t).to.be.instanceOf(DeferredStringTemplate);
        });

        it('format() substitutes numeric indices with args', () => {
            const t = $`hello ${0} world ${1}`;
            expect(t.format('A', 'B')).to.equal('hello A world B');
        });

        it('allows repeated indices (same arg reused)', () => {
            const t = $`${0}-${0}-${0}`;
            expect(t.format('x')).to.equal('x-x-x');
        });

        it('allows non-sequential indices', () => {
            const t = $`${1}, then ${0}`;
            expect(t.format('first', 'second')).to.equal('second, then first');
        });

        it('preserves literal segments untouched', () => {
            const t = $`[int] ${0}`;
            expect(t.format(42)).to.equal('[int] 42');
        });

        it('coerces non-string args via toString()', () => {
            const t = $`${0}`;
            expect(t.format(42)).to.equal('42');
            expect(t.format(true)).to.equal('true');
        });

        it('works with no substitutions', () => {
            const t = $`pure literal`;
            expect(t.format()).to.equal('pure literal');
        });

        it('constructor rejects negative substitution indices', () => {
            // @ts-ignore — exercising runtime guard, not the type-level one.
            expect(() => new DeferredStringTemplate(['a', 'b'] as any, [-1])).to.throw(/positive integers/);
        });

        it('constructor rejects non-integer substitution indices', () => {
            // @ts-ignore
            expect(() => new DeferredStringTemplate(['a', 'b'] as any, [1.5])).to.throw(/positive integers/);
        });
    });

    describe('getBundledFfmpegPath', () => {
        it('returns a string path or null (no throws)', () => {
            const result = getBundledFfmpegPath();
            // The optional ffmpeg-static dependency may or may not be present
            // or compatible with the current arch; both outcomes are valid.
            expect(result === null || typeof result === 'string').to.equal(true);
            if (typeof result === 'string') {
                expect(result.length).to.be.greaterThan(0);
            }
        });
    });
});
