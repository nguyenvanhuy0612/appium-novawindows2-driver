
import { expect } from 'chai';
import {
    PSString,
    PSBoolean,
    PSInt32,
    PSInt32Array,
    PSControlType,
    PSAutomationHeadingLevel,
    PSOrientationType
} from '../../lib/powershell/common';

describe('PowerShell Common Types', () => {
    describe('PSString', () => {
        it('encodes simple string correctly', () => {
            expect(new PSString('Calc').toString()).to.equal('"$([char]0x0043)$([char]0x0061)$([char]0x006c)$([char]0x0063)"');
        });

        it('encodes string with special characters correctly', () => {
            expect(new PSString('\n').toString()).to.equal('"$([char]0x000a)"');
        });

        it('handles empty string', () => {
            expect(new PSString('').toString()).to.equal('""');
        });

        it('handles long content', () => {
            const longStr = 'A'.repeat(10);
            expect(new PSString(longStr).toString()).to.contain('0041');
        });

        it('handles emoji (non-BMP characters)', () => {
            // Appium uses code point encoding for all chars
            expect(new PSString('🚀').toString()).to.contain('d83d');
        });
    });

    describe('PSBoolean', () => {
        it('formats true correctly', () => {
            expect(new PSBoolean(true).toString()).to.equal('$true');
        });

        it('formats false correctly', () => {
            expect(new PSBoolean(false).toString()).to.equal('$false');
        });
    });

    describe('PSInt32', () => {
        it('formats positive integer correctly', () => {
            expect(new PSInt32(123).toString()).to.equal('123');
        });

        it('formats negative integer correctly', () => {
            expect(new PSInt32(-1).toString()).to.equal('-1');
        });

        it('formats zero correctly', () => {
             expect(new PSInt32(0).toString()).to.equal('0');
        });
    });

    describe('PSInt32Array', () => {
        it('formats array correctly', () => {
            expect(new PSInt32Array([1, 2, 3]).toString()).to.equal('[int32[]] @(1, 2, 3)');
        });

        it('handles empty array', () => {
            expect(new PSInt32Array([]).toString()).to.equal('[int32[]] @()');
        });

        it('handles single element array', () => {
            expect(new PSInt32Array([42]).toString()).to.equal('[int32[]] @(42)');
        });
    });

    describe('PSControlType', () => {
        it('formats control type correctly', () => {
            expect(new PSControlType('Button').toString()).to.equal('[ControlType]::Button');
        });

        it('case-insensitivity of input string', () => {
             expect(new PSControlType('button').toString()).to.equal('[ControlType]::button');
        });
    });

    describe('PSAutomationHeadingLevel', () => {
        it('formats heading level correctly', () => {
            expect(new PSAutomationHeadingLevel('level1')).to.be.an('object');
        });
        
        it('throws on invalid level', () => {
             // @ts-ignore
             expect(() => new PSAutomationHeadingLevel('invalid')).to.throw(/valid AutomationHeadingLevel/);
        });
    });

    describe('PSOrientationType', () => {
        it('formats orientation correctly', () => {
            expect(new PSOrientationType('Horizontal').toString()).to.equal('[OrientationType]::Horizontal');
        });
    });
});
