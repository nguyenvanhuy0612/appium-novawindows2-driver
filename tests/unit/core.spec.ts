import { expect } from 'chai';
import { PSObject, decodePwsh, pwsh, pwsh$ } from '../../lib/powershell/core';

// Notes on round-trip behavior:
//   * `pwsh`/`pwsh$` wrap the script in an outer parenthesised envelope:
//       (Invoke-Expression -Command ([System.Text.Encoding]::UTF8.GetString(
//           [System.Convert]::FromBase64String('<base64>'))))
//     so once `decodePwsh` strips the inner Invoke-Expression call,
//     the outer parens remain. Tests must expect the decoded form with
//     those outer parens.
//   * `btoa` (used under the hood) only accepts Latin-1 codepoints.
//     Multi-byte UTF-8 (emoji, accented chars outside Latin-1) will
//     throw at encoding time — that's out of scope for these tests.

describe('powershell/core', () => {
    describe('PSObject', () => {
        it('toString() returns the underlying command', () => {
            const obj = new PSObject('Write-Output "hi"');
            expect(obj.toString()).to.equal('Write-Output "hi"');
        });

        it('supports implicit string coercion via template literal', () => {
            const obj = new PSObject('$el');
            expect(`${obj}`).to.equal('$el');
        });
    });

    describe('pwsh (tag) + decodePwsh (roundtrip)', () => {
        it('wraps a raw script into an Invoke-Expression + base64 envelope', () => {
            const cmd = pwsh`Get-Process`;
            expect(cmd).to.match(/Invoke-Expression -Command/);
            expect(cmd).to.contain('FromBase64String');
            expect(cmd).to.contain('System.Text.Encoding');
        });

        it('starts with an opening paren (outer envelope)', () => {
            const cmd = pwsh`Get-Process`;
            expect(cmd.startsWith('(')).to.equal(true);
            expect(cmd.endsWith(')')).to.equal(true);
        });

        it('decodePwsh recovers the original source (inside outer parens)', () => {
            const cmd = pwsh`Get-Process`;
            expect(decodePwsh(cmd)).to.equal('(Get-Process)');
        });

        it('decodePwsh unwraps nested envelopes', () => {
            const inner = pwsh`echo hi`;
            const cmd = pwsh`${inner}`;
            const decoded = decodePwsh(cmd);
            expect(decoded).to.contain('echo hi');
            expect(decoded).to.not.contain('FromBase64String');
        });

        it('decodePwsh leaves non-pwsh text untouched', () => {
            expect(decodePwsh('plain text')).to.equal('plain text');
            expect(decodePwsh('')).to.equal('');
        });

        it('supports string interpolation in the tagged template', () => {
            const name = 'Calc';
            const cmd = pwsh`Get-Process -Name "${name}"`;
            expect(decodePwsh(cmd)).to.equal('(Get-Process -Name "Calc")');
        });

        it('supports multi-line scripts', () => {
            const cmd = pwsh`
                $p = Get-Process
                $p | Select-Object Name
            `;
            const decoded = decodePwsh(cmd);
            expect(decoded).to.contain('$p = Get-Process');
            expect(decoded).to.contain('Select-Object Name');
        });

        it('handles ASCII punctuation and simple Latin-1 text', () => {
            // Within btoa's Latin-1 range — real-world PS scripts are ASCII.
            const cmd = pwsh`Write-Output "hello, world!"`;
            expect(decodePwsh(cmd)).to.equal('(Write-Output "hello, world!")');
        });
    });

    describe('pwsh$ (deferred template)', () => {
        it('returns a template whose format() produces an encoded command', () => {
            const t = pwsh$`Get-Process -Name ${0}`;
            const cmd = t.format('"Calc"');
            expect(cmd).to.contain('FromBase64String');
            expect(decodePwsh(cmd)).to.equal('(Get-Process -Name "Calc")');
        });

        it('re-encodes on each format() call independently', () => {
            const t = pwsh$`${0}-${0}-${1}`;
            expect(decodePwsh(t.format('a', 'b'))).to.equal('(a-a-b)');
            expect(decodePwsh(t.format('x', 'y'))).to.equal('(x-x-y)');
        });
    });
});
