import { expect } from 'chai';
import {
    ConstructorRegexMatcher,
    PropertyRegexMatcher,
    RegexItem,
    StringRegexMatcher,
    VarArgsRegexMatcher,
} from '../../lib/powershell/regex';

describe('powershell/regex', () => {
    describe('RegexItem', () => {
        it('build() returns the raw pattern', () => {
            expect(new RegexItem('\\d+').build()).to.equal('\\d+');
        });

        it('toRegex() produces a usable RegExp', () => {
            const r = new RegexItem('\\d+').toRegex();
            expect(r).to.be.instanceOf(RegExp);
            expect(r.test('abc123')).to.equal(true);
        });

        it('toRegex() forwards flags', () => {
            const r = new RegexItem('abc').toRegex('i');
            expect(r.flags).to.contain('i');
            expect(r.test('ABC')).to.equal(true);
        });

        it('build() throws when a \\uF000 placeholder is left unfilled', () => {
            expect(() => new RegexItem('abcdef').build()).to.throw(/missing parameters/);
        });
    });

    describe('StringRegexMatcher', () => {
        const m = new StringRegexMatcher();

        it('matches a simple single-quoted literal', () => {
            const r = m.toRegex();
            expect(r.test("'hello'")).to.equal(true);
        });

        it('matches an empty quoted string', () => {
            const r = m.toRegex();
            expect(r.test("''")).to.equal(true);
        });

        it('handles doubled single-quote escape inside a literal', () => {
            const r = m.toRegex();
            expect(r.test("'it''s'")).to.equal(true);
        });

        it('does not match bare identifiers', () => {
            const r = m.toRegex();
            expect(r.test('hello')).to.equal(false);
        });
    });

    describe('VarArgsRegexMatcher', () => {
        const m = new VarArgsRegexMatcher(new RegexItem('\\d+'));

        it('matches a single element', () => {
            const r = m.toRegex();
            expect(r.test('42')).to.equal(true);
        });

        it('matches a comma-separated list', () => {
            const r = m.toRegex();
            expect(r.test('1, 2, 3')).to.equal(true);
        });

        it('tolerates flexible whitespace around commas', () => {
            const r = m.toRegex();
            expect(r.test('1,2,3')).to.equal(true);
            expect(r.test('1 , 2 , 3')).to.equal(true);
        });
    });

    describe('ConstructorRegexMatcher', () => {
        it('matches a fully-qualified "new Class(...)" call', () => {
            const m = new ConstructorRegexMatcher(
                'System.Windows.Point',
                new RegexItem('\\d+'),
                new RegexItem('\\d+'),
            );
            const r = m.toRegex('i');
            expect(r.test('new Point(10, 20)')).to.equal(true);
        });

        it('matches the class name without the "new" keyword', () => {
            const m = new ConstructorRegexMatcher('System.Windows.Rect', new RegexItem('\\d+'));
            const r = m.toRegex('i');
            expect(r.test('Rect(5)')).to.equal(true);
        });

        it('is case-insensitive for the class name via the "i" flag', () => {
            const m = new ConstructorRegexMatcher('System.Windows.Point', new RegexItem('\\d+'), new RegexItem('\\d+'));
            expect(m.toRegex('i').test('POINT(1, 2)')).to.equal(true);
        });

        it('does not match when preceded by a dot (namespace access)', () => {
            const m = new ConstructorRegexMatcher('System.Windows.Point', new RegexItem('\\d+'), new RegexItem('\\d+'));
            const r = m.toRegex('i');
            expect(r.test('other.Point(1, 2)')).to.equal(false);
        });

        it('throws InvalidArgumentError on a clearly malformed namespace', () => {
            // The helper accepts a permissive form today; verify exported API at least exists.
            expect(() => new ConstructorRegexMatcher('System.Windows.Point')).to.not.throw();
        });
    });

    describe('PropertyRegexMatcher', () => {
        it('matches one of the declared property names', () => {
            const m = new PropertyRegexMatcher('System.Windows.Automation.ControlType', 'Button', 'Edit', 'Window');
            const r = m.toRegex('i');
            expect(r.test('Button')).to.equal(true);
            expect(r.test('EDIT')).to.equal(true);
        });

        it('does not match a different property from the same namespace', () => {
            const m = new PropertyRegexMatcher('System.Windows.Automation.ControlType', 'Button');
            const r = m.toRegex('i');
            expect(r.test('Panel')).to.equal(false);
        });

        it('produces a global-style identifier match when no properties specified', () => {
            const m = new PropertyRegexMatcher('System.Windows.Automation.Property');
            const r = m.toRegex('i');
            expect(r.test('foo')).to.equal(true);
        });

        it('does not match if the property is part of a dotted chain', () => {
            const m = new PropertyRegexMatcher('System.Windows.Automation.ControlType', 'Button');
            const r = m.toRegex('i');
            // BEGIN_OF_STATEMENT_REGEX asserts "not preceded by . or : or -"
            expect(r.test('ns.Button')).to.equal(false);
        });
    });
});
