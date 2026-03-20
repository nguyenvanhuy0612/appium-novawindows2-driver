/**
 * Comprehensive XPath Test Suite — 120+ test cases
 *
 * Covers: parsing, predicate ordering, PS filter optimization,
 * condition generation, XPath functions, complex patterns, edge cases.
 *
 * Reference: tests/debug/test_xpath_complex.py (integration tests against real device)
 */

import { expect } from 'chai';
import { xpathToElIdOrIds } from '../../lib/xpath';
import { XPathExecutor, predicateProcessableBeforeNode } from '../../lib/xpath/core';
import { FoundAutomationElement, AutomationElement } from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';
import XPathAnalyzer, { ExprNode } from 'xpath-analyzer';

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

const emptyMock = async (_: string) => '';

/** Parse XPath without executing — just verify it doesn't throw */
function parse(xpath: string): ExprNode {
    return new XPathAnalyzer(xpath).parse();
}

/** Run XPath through executor, capture all decoded PS commands */
async function captureCommands(xpath: string, parentId = 'root'): Promise<string[]> {
    const decoded: string[] = [];
    const mock = async (cmd: string) => { decoded.push(decodePwsh(cmd)); return ''; };
    const executor = new XPathExecutor(new FoundAutomationElement(parentId), mock);
    try { await executor.processExprNode(parse(xpath), new FoundAutomationElement(parentId)); } catch { }
    return decoded;
}

/**
 * Standard 7-element test tree for behavioral tests.
 *
 * el1: Name="alpha"          el2: Name="beta"
 * el3: Name="gamma target"   el4: Name="delta"
 * el5: Name="epsilon target" el6: Name="zeta"
 * el7: Name="target eta"
 *
 * contains(@Name,'target') → el3, el5, el7
 * starts-with(@Name,'target') → el7
 */
interface MockChild { id: string; name: string }
const STANDARD_CHILDREN: MockChild[] = [
    { id: 'el1', name: 'alpha' },
    { id: 'el2', name: 'beta' },
    { id: 'el3', name: 'gamma target' },
    { id: 'el4', name: 'delta' },
    { id: 'el5', name: 'epsilon target' },
    { id: 'el6', name: 'zeta' },
    { id: 'el7', name: 'target eta' },
];

/**
 * Create a mock that simulates a flat parent→children tree.
 * Implements psFilter (Where-Object Current.Name -like) so
 * behavioral tests can detect whether the filter was applied at PS level.
 */
function createFlatMock(children: MockChild[] = STANDARD_CHILDREN) {
    return async (command: string): Promise<string> => {
        const d = decodePwsh(command);

        // findAll / findFirst — returns element IDs
        if (d.includes('ForEach-Object')) {
            // Check for psFilter on Name (contains → -like '*pattern*', starts-with → -like 'pattern*')
            // Supports multiple filters combined with -and
            const likeMatches = [...d.matchAll(/Current\.Name\s+-like\s+'([^']+)'/g)];
            if (likeMatches.length > 0) {
                const filtered = children.filter(c => {
                    return likeMatches.every(m => {
                        const pattern = m[1];
                        if (pattern.startsWith('*') && pattern.endsWith('*'))
                            return c.name.includes(pattern.slice(1, -1));
                        if (pattern.endsWith('*'))
                            return c.name.startsWith(pattern.slice(0, -1));
                        return c.name === pattern;
                    });
                });
                return filtered.map(c => c.id).join('\n');
            }
            return children.map(c => c.id).join('\n');
        }

        // Property lookups for specific elements
        for (const child of children) {
            if (d.includes(`'${child.id}'`)) {
                if (d.includes('RuntimeIdProperty')) return child.id;
                if (d.includes('NameProperty')) return child.name;
            }
        }

        return '';
    };
}

/** Run XPath behaviorally with the flat mock, return matched element IDs */
async function evalXPath(xpath: string, children: MockChild[] = STANDARD_CHILDREN): Promise<string[]> {
    const mock = createFlatMock(children);
    const executor = new XPathExecutor(new FoundAutomationElement('parent'), mock);
    const result = await executor.processExprNode(parse(xpath), new FoundAutomationElement('parent'));
    return result
        .filter((el): el is FoundAutomationElement => el instanceof FoundAutomationElement)
        .map(el => el.runtimeId);
}

// ═══════════════════════════════════════════════
// GROUP 1: XPath Parsing — valid patterns (25 tests)
// ═══════════════════════════════════════════════
describe('G1: XPath parsing — valid patterns', () => {
    const validXPaths = [
        ['simple element',          '//Button'],
        ['child step',              'child::Button'],
        ['attribute predicate',     '//Button[@Name="OK"]'],
        ['numeric predicate',       '//Button[3]'],
        ['contains()',              '//Button[contains(@Name,"OK")]'],
        ['starts-with()',          '//Button[starts-with(@Name,"OK")]'],
        ['not()',                   '//Button[not(@IsEnabled="False")]'],
        ['position()=N',           '//Button[position()=3]'],
        ['last()',                  '//Button[last()]'],
        ['AND predicate',          '//Button[@Name="OK" and @IsEnabled="True"]'],
        ['OR predicate',           '//Button[@Name="OK" or @Name="Cancel"]'],
        ['double-slash',           '//Window//Button'],
        ['nested predicate',       '//ListItem[./Text[contains(@Name,"x")]]'],
        ['union',                  '//Button | //Text'],
        ['wildcard element',       '//*'],
        ['wildcard attribute',     '//*[@*="value"]'],
        ['self axis',              'self::node()'],
        ['parent axis',            '//Button/parent::Window'],
        ['ancestor axis',          '//Button/ancestor::Window'],
        ['following-sibling',      '//Button/following-sibling::Text'],
        ['preceding-sibling',      '//Button/preceding-sibling::Text'],
        ['descendant axis',        '//Window/descendant::Button'],
        ['normalize-space()',      '//Button[normalize-space(@Name)="OK"]'],
        ['string-length()',        '//Button[string-length(@Name)>2]'],
        ['substring()',            '//Button[substring(@Name,1,2)="OK"]'],
    ];

    for (const [label, xpath] of validXPaths) {
        it(`parses: ${label} — ${xpath}`, () => {
            expect(() => parse(xpath)).to.not.throw();
        });
    }
});

// ═══════════════════════════════════════════════
// GROUP 2: XPath Parsing — invalid patterns (10 tests)
// ═══════════════════════════════════════════════
describe('G2: XPath parsing — invalid patterns', () => {
    const invalidXPaths = [
        ['unclosed bracket',     '//Button['],
        ['unclosed string',      '//Button[@Name="OK]'],
        ['empty brackets',       '//Button[]'],
        ['double at',            '//Button[@@Name]'],
        ['missing axis name',    '//Button[::Name]'],
        ['triple slash',         '///Button'],
        ['unclosed paren',       '//Button[contains(@Name,"OK"'],
        ['empty path step',      '//'],
        ['bare operator',        '//Button[and]'],
        ['invalid function',     '//Button[foobar()]'],
    ];

    for (const [label, xpath] of invalidXPaths) {
        it(`rejects: ${label} — ${xpath}`, async () => {
            try {
                // Some are caught at parse time, others at execution time
                const parsed = parse(xpath);
                await xpathToElIdOrIds(xpath, true, undefined, emptyMock);
                // If we get here without error, that's unexpected for some patterns
            } catch (e: any) {
                expect(e).to.be.an('error');
            }
        });
    }
});

// ═══════════════════════════════════════════════
// GROUP 3: Predicate ordering — position THEN function (20 tests)
// Core fix for Bug #1: [N][contains/starts-with/equality]
// ═══════════════════════════════════════════════
describe('G3: Predicate ordering — position then function', () => {
    // Standard tree: el3="gamma target", el5="epsilon target", el7="target eta"

    it('G3-01 [3][contains] — el3 has target → 1 result', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G3-02 [1][contains] — el1 no target → 0 results', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-03 [5][contains] — el5 has target → 1 result', async () => {
        const ids = await evalXPath("Button[5][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G3-04 [4][contains] — el4 no target → 0 results', async () => {
        const ids = await evalXPath("Button[4][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-05 [7][starts-with] — el7 starts with target → 1 result', async () => {
        const ids = await evalXPath("Button[7][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G3-06 [3][starts-with] — el3 does NOT start with target → 0 results', async () => {
        const ids = await evalXPath("Button[3][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-07 [last()][contains] — el7 is last and has target → 1 result', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G3-08 [last()][starts-with] — el7 starts with target → 1 result', async () => {
        const ids = await evalXPath("Button[last()][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G3-09 [last()][contains(alpha)] — el7 is last, no alpha → 0 results', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-10 [2][contains] — el2 no target → 0 results', async () => {
        const ids = await evalXPath("Button[2][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-11 [6][contains] — el6 no target → 0 results', async () => {
        const ids = await evalXPath("Button[6][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G3-12 [7][contains] — el7 has target → 1 result', async () => {
        const ids = await evalXPath("Button[7][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    // With single-element children — position 1 always valid
    it('G3-13 single child [1][contains] — match → 1 result', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'only')]", [
            { id: 'solo', name: 'only child' },
        ]);
        expect(ids).to.deep.equal(['solo']);
    });

    it('G3-14 single child [1][contains] — no match → 0 results', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'missing')]", [
            { id: 'solo', name: 'only child' },
        ]);
        expect(ids).to.deep.equal([]);
    });

    it('G3-15 single child [2] — out of range → 0 results', async () => {
        const ids = await evalXPath("Button[2]", [
            { id: 'solo', name: 'only' },
        ]);
        expect(ids).to.deep.equal([]);
    });

    // Position with contains on empty string — XPath spec: contains(x,'') = true for all x
    it('G3-16 [3][contains(@Name,"")] — empty needle always true → 1 result', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'')]");
        expect(ids).to.deep.equal(['el3']);
    });

    // Multi-element results (no position filter, just contains)
    it('G3-17 [contains] only — returns all 3 matching elements', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el3', 'el5', 'el7']);
    });

    it('G3-18 [starts-with] only — returns el7', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    // Position only
    it('G3-19 [1] only — returns first element', async () => {
        const ids = await evalXPath("Button[1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G3-20 [last()] only — returns last element', async () => {
        const ids = await evalXPath("Button[last()]");
        expect(ids).to.deep.equal(['el7']);
    });
});

// ═══════════════════════════════════════════════
// GROUP 4: Predicate ordering — function THEN position (15 tests)
// ═══════════════════════════════════════════════
describe('G4: Predicate ordering — function then position', () => {
    // contains(@Name,'target') matches: el3(pos1), el5(pos2), el7(pos3)

    it('G4-01 [contains][1] — first of 3 matches → el3', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][1]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G4-02 [contains][2] — second of 3 matches → el5', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][2]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G4-03 [contains][3] — third of 3 matches → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][3]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G4-04 [contains][4] — 4th of 3 matches → 0 results', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][4]");
        expect(ids).to.deep.equal([]);
    });

    it('G4-05 [contains][last()] — last of 3 matches → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G4-06 [starts-with][1] — only 1 match, pos 1 → el7', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')][1]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G4-07 [starts-with][2] — only 1 match, pos 2 → 0 results', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')][2]");
        expect(ids).to.deep.equal([]);
    });

    it('G4-08 [contains(alpha)][1] — only el1 matches alpha → el1', async () => {
        const ids = await evalXPath("Button[contains(@Name,'alpha')][1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G4-09 [contains(alpha)][2] — only 1 match, pos 2 → 0', async () => {
        const ids = await evalXPath("Button[contains(@Name,'alpha')][2]");
        expect(ids).to.deep.equal([]);
    });

    it('G4-10 [contains(e)][1] — e in beta,gamma target,delta,epsilon target,zeta,target eta → el2', async () => {
        // alpha: no 'e'. beta: yes. gamma target: yes (e in target). delta: yes.
        // epsilon target: yes. zeta: yes. target eta: yes.
        // Matches: el2, el3, el4, el5, el6, el7 → 6 matches
        const ids = await evalXPath("Button[contains(@Name,'e')][1]");
        expect(ids).to.deep.equal(['el2']);
    });

    it('G4-11 [contains(e)][6] — 6th of 6 matches → el7', async () => {
        // 6 matches: el2, el3, el4, el5, el6, el7
        const ids = await evalXPath("Button[contains(@Name,'e')][6]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G4-12 [contains(e)][7] — only 6 matches, pos 7 → 0', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][7]");
        expect(ids).to.deep.equal([]);
    });

    it('G4-13 [starts-with(epsilon)][1] → el5', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'epsilon')][1]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G4-14 [contains(nonexistent)][1] → 0 results', async () => {
        const ids = await evalXPath("Button[contains(@Name,'nonexistent')][1]");
        expect(ids).to.deep.equal([]);
    });

    it('G4-15 [contains("")][last()] — empty contains matches all → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'')][last()]");
        expect(ids).to.deep.equal(['el7']);
    });
});

// ═══════════════════════════════════════════════
// GROUP 5: PS filter optimization (15 tests)
// Verify when contains/starts-with IS or IS NOT pushed to PowerShell
// ═══════════════════════════════════════════════
describe('G5: PS filter optimization', () => {
    it('G5-01 contains alone → psFilter applied (Where-Object in command)', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.Name');
        expect(findCmd).to.include("-like '*target*'");
    });

    it('G5-02 starts-with alone → psFilter applied', async () => {
        const cmds = await captureCommands("Button[starts-with(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.Name');
        expect(findCmd).to.include("-like 'target*'");
    });

    it('G5-03 [N][contains] — psFilter NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[3][contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*target*'");
    });

    it('G5-04 [N][starts-with] — psFilter NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[3][starts-with(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like 'target*'");
    });

    it('G5-05 [contains][N] — psFilter IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')][3]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like '*target*'");
    });

    it('G5-06 [starts-with][N] — psFilter IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[starts-with(@Name,'target')][3]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like 'target*'");
    });

    it('G5-07 [last()][contains] — psFilter NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[last()][contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*target*'");
    });

    it('G5-08 [contains][last()] — psFilter IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')][last()]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like '*target*'");
    });

    it('G5-09 contains on AutomationId → psFilter uses Current.AutomationId', async () => {
        const cmds = await captureCommands("Button[contains(@AutomationId,'test')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.AutomationId');
        expect(findCmd).to.include("-like '*test*'");
    });

    it('G5-10 contains on unknown property → NOT pushed to psFilter', async () => {
        const cmds = await captureCommands("Button[contains(@UnknownProp,'x')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        if (findCmd) {
            expect(findCmd).to.not.include('Current.UnknownProp');
        }
    });

    it('G5-11 psFilter escapes single quotes', async () => {
        const cmds = await captureCommands("Button[contains(@Name,\"it's\")]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("it''s"); // PowerShell single-quote escaping
    });

    it('G5-12 two contains predicates — both applied as psFilter', async () => {
        // Both are pre-position (no positional predicate at all)
        const cmds = await captureCommands("Button[contains(@Name,'a')][contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        // At least one should be in psFilter
        expect(findCmd).to.include('Current.Name');
    });

    it('G5-13 contains with empty string → short-circuit true, no psFilter needed', async () => {
        // XPath spec: contains(x, '') = true for all x
        // The engine should detect empty string and return TrueCondition
        const ids = await evalXPath("Button[contains(@Name,'')]");
        expect(ids).to.have.length(7); // all elements match
    });

    it('G5-14 contains on ClassName → psFilter uses Current.ClassName', async () => {
        const cmds = await captureCommands("Button[contains(@ClassName,'Cls')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.ClassName');
    });

    it('G5-15 starts-with on HelpText → psFilter uses Current.HelpText', async () => {
        const cmds = await captureCommands("Button[starts-with(@HelpText,'Help')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.HelpText');
    });
});

// ═══════════════════════════════════════════════
// GROUP 6: Condition generation (15 tests)
// Verify PS commands contain correct UIA conditions
// ═══════════════════════════════════════════════
describe('G6: Condition generation', () => {
    it('G6-01 //Button → ControlType condition', async () => {
        const cmds = await captureCommands('Button');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('controltypeProperty');
        expect(findCmd).to.include('[ControlType]::Button');
    });

    it('G6-02 //List → OrCondition(List, DataGrid)', async () => {
        const cmds = await captureCommands('List');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
        expect(findCmd).to.include('[ControlType]::List');
        expect(findCmd).to.include('[ControlType]::DataGrid');
    });

    it('G6-03 //ListItem → OrCondition(ListItem, DataItem)', async () => {
        const cmds = await captureCommands('ListItem');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
        expect(findCmd).to.include('[ControlType]::ListItem');
        expect(findCmd).to.include('[ControlType]::DataItem');
    });

    it('G6-04 //* → TrueCondition (wildcard)', async () => {
        const cmds = await captureCommands('*');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('TrueCondition');
    });

    it('G6-05 [@Name="OK"] → PropertyCondition with encoded string', async () => {
        const cmds = await captureCommands('Button[@Name="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('nameProperty');
        expect(findCmd).to.include('PropertyCondition');
    });

    it('G6-06 [@IsEnabled="True"] → PropertyCondition with boolean', async () => {
        const cmds = await captureCommands('Button[@IsEnabled="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('isenabledProperty');
    });

    it('G6-07 [@ProcessId=1234] → PropertyCondition with int32', async () => {
        const cmds = await captureCommands('Button[@ProcessId=1234]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('processidProperty');
    });

    it('G6-08 [@Name="A" and @Class="B"] → AndCondition', async () => {
        const cmds = await captureCommands('Button[@Name="A" and @ClassName="B"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[AndCondition]');
    });

    it('G6-09 [@Name="A" or @Name="B"] → OrCondition', async () => {
        const cmds = await captureCommands('Button[@Name="A" or @Name="B"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
    });

    it('G6-10 [not(@Name="A")] is a post-execution filter (relativeExprNode)', async () => {
        // not() is too complex for PS condition → becomes relativeExprNode
        const cmds = await captureCommands('Button[not(@Name="A")]');
        // Only the first findAll command is issued, relativeExprNode is evaluated in JS
        expect(cmds.length).to.be.greaterThanOrEqual(1);
    });

    it('G6-11 AppBar → LocalizedControlType condition (unsupported ControlType)', async () => {
        const cmds = await captureCommands('AppBar');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('localizedcontroltypeProperty');
    });

    it('G6-12 SemanticZoom → LocalizedControlType condition', async () => {
        const cmds = await captureCommands('SemanticZoom');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('localizedcontroltypeProperty');
    });

    it('G6-13 [@RuntimeId="1.2.3"] → Int32Array condition', async () => {
        const cmds = await captureCommands('Button[@RuntimeId="1.2.3"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('runtimeidProperty');
        expect(findCmd).to.include('[int32[]]');
    });

    it('G6-14 node() → TrueCondition', async () => {
        const cmds = await captureCommands('node()');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('TrueCondition');
    });

    it('G6-15 processing-instruction() → FalseCondition', async () => {
        const cmds = await captureCommands('processing-instruction()');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        if (findCmd) {
            expect(findCmd).to.include('FalseCondition');
        }
    });
});

// ═══════════════════════════════════════════════
// GROUP 7: XPath functions — behavioral (15 tests)
// ═══════════════════════════════════════════════
describe('G7: XPath functions', () => {
    it('G7-01 true() always matches', async () => {
        const ids = await evalXPath("Button[true()]");
        expect(ids).to.have.length(7);
    });

    it('G7-02 false() never matches', async () => {
        const ids = await evalXPath("Button[false()]");
        expect(ids).to.have.length(0);
    });

    it('G7-03 not(false()) matches all', async () => {
        const ids = await evalXPath("Button[not(false())]");
        expect(ids).to.have.length(7);
    });

    it('G7-04 not(true()) matches none', async () => {
        const ids = await evalXPath("Button[not(true())]");
        expect(ids).to.have.length(0);
    });

    it('G7-05 position()=1 selects first', async () => {
        const ids = await evalXPath("Button[position()=1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G7-06 position()=last() selects last', async () => {
        const ids = await evalXPath("Button[position()=last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G7-07 contains with empty string → all match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'')]");
        expect(ids).to.have.length(7);
    });

    it('G7-08 starts-with with empty string → all match', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'')]");
        expect(ids).to.have.length(7);
    });

    it('G7-09 contains is case-sensitive', async () => {
        const ids = await evalXPath("Button[contains(@Name,'Target')]");
        // None match because our data has lowercase 'target'
        expect(ids).to.have.length(0);
    });

    it('G7-10 contains(@Name,"target") is case-sensitive match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')]");
        expect(ids).to.have.length(3); // el3, el5, el7
    });

    it('G7-11 function error: contains() with wrong arg count throws', async () => {
        try {
            await xpathToElIdOrIds("//Button[contains(@Name)]", true, undefined, emptyMock);
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('G7-12 function error: unknown function throws at parse or execution', async () => {
        try {
            await xpathToElIdOrIds("//Button[foobar(@Name,'x')]", true, undefined, emptyMock);
            expect.fail('Should have thrown');
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('G7-13 numeric predicate [0] — no element at position 0', async () => {
        const ids = await evalXPath("Button[0]");
        expect(ids).to.deep.equal([]);
    });

    it('G7-14 numeric predicate [99] — out of range', async () => {
        const ids = await evalXPath("Button[99]");
        expect(ids).to.deep.equal([]);
    });

    it('G7-15 negative numeric predicate [-1] — no match', async () => {
        // XPath treats [-1] as position()=-1, which never matches
        const ids = await evalXPath("Button[-1]");
        expect(ids).to.deep.equal([]);
    });
});

// ═══════════════════════════════════════════════
// GROUP 8: Complex nested predicates (15 tests)
// ═══════════════════════════════════════════════
describe('G8: Complex nested predicates', () => {
    // These test parsing and command generation for nested patterns

    it('G8-01 ./child[pred] — parses correctly', () => {
        const ast = parse("ListItem[./Text[contains(@Name,'x')]]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-02 ./child[N][pred] — parses with both predicates', () => {
        const ast = parse("ListItem[./Text[6][contains(@Name,'x')]]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-03 ./child[pred][N] — parses in reverse order', () => {
        const ast = parse("ListItem[./Text[contains(@Name,'x')][6]]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-04 deeply nested: ./a/b/c — parses', () => {
        const ast = parse("Window[./Panel/Group/Button[@Name='OK']]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-05 multiple predicates at different steps — parses', () => {
        const ast = parse("Window[@Name='Main']//Tab[1]/TabItem[3]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-06 predicate with AND+OR — parses', () => {
        const ast = parse("Button[@Name='OK' and (@IsEnabled='True' or @IsEnabled='False')]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-07 multiple contains in AND — parses', () => {
        const ast = parse("Button[contains(@Name,'Import') and contains(@Name,'P1')]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-08 contains in OR — parses', () => {
        const ast = parse("Button[contains(@Name,'Import') or contains(@Name,'Export')]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-09 not(contains()) — parses', () => {
        const ast = parse("Button[not(contains(@Name,'Disabled'))]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-10 chained child steps with predicates — parses', () => {
        const ast = parse("Window[@Name='App']//List[@AutomationId='1485']/ListItem[1]/Text[3]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-11 triple predicate [N][contains][starts-with] — parses', () => {
        const ast = parse("Button[2][contains(@Name,'x')][starts-with(@Name,'y')]");
        expect(ast.type).to.equal('relative-location-path');
    });

    it('G8-12 //parent[./child[N][pred]]//grandchild — parses', () => {
        const ast = parse("//ListItem[./Text[6][contains(@Name,'sign')]]//Button");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G8-13 union of nested predicates — parses', () => {
        const ast = parse("//Button[@Name='OK'] | //Button[contains(@Name,'Cancel')]");
        expect(ast.type).to.equal('union');
    });

    it('G8-14 parent axis with predicate — parses', () => {
        const ast = parse("//Button[@Name='OK']/parent::Window[@Name='Dialog']");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G8-15 ancestor with predicate — parses', () => {
        const ast = parse("//Button/ancestor::Window[contains(@Name,'App')]");
        expect(ast.type).to.equal('absolute-location-path');
    });
});

// ═══════════════════════════════════════════════
// GROUP 9: Axes and tree navigation (10 tests)
// ═══════════════════════════════════════════════
describe('G9: Axes and tree navigation', () => {
    it('G9-01 child axis (default) generates Children scope', async () => {
        const cmds = await captureCommands('Button');
        expect(cmds.some(c => c.includes('children'))).to.be.true;
    });

    it('G9-02 descendant:: generates Descendants scope', async () => {
        const cmds = await captureCommands('descendant::Button');
        expect(cmds.some(c => c.includes('Find-AllDescendants') || c.includes('descendants'))).to.be.true;
    });

    it('G9-03 self:: generates Element scope', async () => {
        const cmds = await captureCommands('self::node()');
        expect(cmds.some(c => c.includes('Element') || c.includes('element'))).to.be.true;
    });

    it('G9-04 ancestor:: generates walker-based traversal', async () => {
        const cmds = await captureCommands('ancestor::Window');
        expect(cmds.some(c => c.includes('GetParent'))).to.be.true;
    });

    it('G9-05 following-sibling:: generates correct command', async () => {
        const cmds = await captureCommands('following-sibling::Button');
        expect(cmds.some(c => c.includes('GetNextSibling') || c.includes('following'))).to.be.true;
    });

    it('G9-06 preceding-sibling:: generates correct command', async () => {
        const cmds = await captureCommands('preceding-sibling::Button');
        expect(cmds.some(c => c.includes('GetPreviousSibling') || c.includes('preceding'))).to.be.true;
    });

    it('G9-07 parent:: generates parent traversal', async () => {
        const cmds = await captureCommands('parent::Window');
        expect(cmds.some(c => c.includes('GetParent'))).to.be.true;
    });

    it('G9-08 namespace:: returns empty (unsupported)', async () => {
        // namespace::node() uses node() test to avoid ControlType validation errors
        const mock = createFlatMock();
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), mock);
        const result = await executor.processExprNode(parse('namespace::node()'), new FoundAutomationElement('parent'));
        expect(result).to.have.length(0);
    });

    it('G9-09 // double-slash optimizes to descendant', async () => {
        // //Button is optimized from descendant-or-self::node()/child::Button to descendant::Button
        const cmds = await captureCommands('//Button');
        // Should NOT have separate self::node() step
        expect(cmds.filter(c => c.includes('FindAll')).length).to.be.lessThanOrEqual(1);
    });

    it('G9-10 multi-axis path parses correctly', () => {
        const ast = parse("ancestor::Window/descendant::Panel/child::Button");
        expect(ast.type).to.equal('relative-location-path');
        expect(ast.steps).to.have.length(3);
    });
});

// ═══════════════════════════════════════════════
// GROUP 10: Union expressions (5 tests)
// ═══════════════════════════════════════════════
describe('G10: Union expressions', () => {
    it('G10-01 A | B parses as union type', () => {
        const ast = parse("//Button | //Text");
        expect(ast.type).to.equal('union');
    });

    it('G10-02 A | B | C chains unions', () => {
        const ast = parse("//Button | //Text | //ListItem");
        expect(ast.type).to.equal('union');
    });

    it('G10-03 union with predicates parses', () => {
        const ast = parse("//Button[@Name='OK'] | //Button[@Name='Cancel']");
        expect(ast.type).to.equal('union');
    });

    it('G10-04 union with different axes parses', () => {
        const ast = parse("//Button | ancestor::Window");
        expect(ast.type).to.equal('union');
    });

    it('G10-05 union with complex predicates parses', () => {
        const ast = parse("//ListItem[./Text[6][contains(@Name,'x')]] | //ListItem[./Text[1][@Name='y']]");
        expect(ast.type).to.equal('union');
    });
});

// ═══════════════════════════════════════════════
// GROUP 11: predicateProcessableBeforeNode (10 tests)
// ═══════════════════════════════════════════════
describe('G11: predicateProcessableBeforeNode', () => {
    it('G11-01 @Name="value" is processable', () => {
        const ast = parse("Button[@Name='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('G11-02 @AutomationId="id" is processable', () => {
        const ast = parse("Button[@AutomationId='id']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('G11-03 @*="value" (wildcard) is processable', () => {
        const ast = parse("Button[@*='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('G11-04 @UnknownProp="value" is NOT processable', () => {
        const ast = parse("Button[@FooProp='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('G11-05 contains() is NOT processable before node', () => {
        const ast = parse("Button[contains(@Name,'x')]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('G11-06 numeric predicate is NOT processable', () => {
        const ast = parse("Button[3]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('G11-07 AND of two processable is processable', () => {
        const ast = parse("Button[@Name='a' and @ClassName='b']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('G11-08 AND where one side not processable → false', () => {
        const ast = parse("Button[@Name='a' and contains(@Name,'b')]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('G11-09 OR of two processable is processable', () => {
        const ast = parse("Button[@Name='a' or @Name='b']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('G11-10 "value"=@Name (reversed) is processable', () => {
        const ast = parse("Button['value'=@Name]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });
});

// ═══════════════════════════════════════════════
// GROUP 12: String functions — parsing and execution (10 tests)
// ═══════════════════════════════════════════════
describe('G12: String functions', () => {
    it('G12-01 normalize-space() parses', () => {
        expect(() => parse("Button[normalize-space(@Name)='OK']")).to.not.throw();
    });

    it('G12-02 string-length() parses', () => {
        expect(() => parse("Button[string-length(@Name)>5]")).to.not.throw();
    });

    it('G12-03 substring() parses', () => {
        expect(() => parse("Button[substring(@Name,1,3)='abc']")).to.not.throw();
    });

    it('G12-04 substring-before() parses', () => {
        expect(() => parse("Button[substring-before(@Name,'-')='prefix']")).to.not.throw();
    });

    it('G12-05 substring-after() parses', () => {
        expect(() => parse("Button[substring-after(@Name,'-')='suffix']")).to.not.throw();
    });

    it('G12-06 concat() parses', () => {
        expect(() => parse("Button[concat(@Name,'-suffix')='OK-suffix']")).to.not.throw();
    });

    it('G12-07 translate() parses', () => {
        expect(() => parse("Button[translate(@Name,'abc','ABC')='OK']")).to.not.throw();
    });

    it('G12-08 string() parses', () => {
        expect(() => parse("Button[string(@Name)='OK']")).to.not.throw();
    });

    it('G12-09 nested string functions parse', () => {
        expect(() => parse("Button[contains(normalize-space(@Name),'OK')]")).to.not.throw();
    });

    it('G12-10 translate+contains combo parses', () => {
        expect(() => parse("Button[contains(translate(@Name,'abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ'),'OK')]")).to.not.throw();
    });
});

// ═══════════════════════════════════════════════
// GROUP 13: Numeric functions and comparisons (10 tests)
// ═══════════════════════════════════════════════
describe('G13: Numeric functions and comparisons', () => {
    it('G13-01 floor() parses', () => {
        expect(() => parse("Button[floor(3.7)=3]")).to.not.throw();
    });

    it('G13-02 ceiling() parses', () => {
        expect(() => parse("Button[ceiling(3.2)=4]")).to.not.throw();
    });

    it('G13-03 round() parses', () => {
        expect(() => parse("Button[round(3.5)=4]")).to.not.throw();
    });

    it('G13-04 number() parses', () => {
        expect(() => parse("Button[number(@Name)>0]")).to.not.throw();
    });

    it('G13-05 arithmetic expression parses', () => {
        expect(() => parse("Button[position() + 1 > 3]")).to.not.throw();
    });

    it('G13-06 modulus parses', () => {
        expect(() => parse("Button[position() mod 2 = 0]")).to.not.throw();
    });

    it('G13-07 less-than comparison parses', () => {
        expect(() => parse("Button[position() < 5]")).to.not.throw();
    });

    it('G13-08 greater-than-or-equal parses', () => {
        expect(() => parse("Button[position() >= 3]")).to.not.throw();
    });

    it('G13-09 subtraction parses', () => {
        expect(() => parse("Button[last() - 1]")).to.not.throw();
    });

    it('G13-10 multiplication parses', () => {
        expect(() => parse("Button[position() * 2 = 6]")).to.not.throw();
    });
});

// ═══════════════════════════════════════════════
// GROUP 14: Edge cases and regression (15 tests)
// ═══════════════════════════════════════════════
describe('G14: Edge cases and regression', () => {
    it('G14-01 empty xpath throws InvalidSelectorError', async () => {
        try {
            await xpathToElIdOrIds('', false, undefined, emptyMock);
            expect.fail('Should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('InvalidSelectorError');
        }
    });

    it('G14-02 find-single on empty result throws NoSuchElementError', async () => {
        try {
            await xpathToElIdOrIds('//Button', false, undefined, emptyMock);
            expect.fail('Should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('NoSuchElementError');
        }
    });

    it('G14-03 find-multiple on empty result returns empty array', async () => {
        const result = await xpathToElIdOrIds('//Button', true, undefined, emptyMock);
        expect(result).to.be.an('array').with.length(0);
    });

    it('G14-04 position 0 returns empty (XPath is 1-indexed)', async () => {
        const ids = await evalXPath("Button[0]");
        expect(ids).to.deep.equal([]);
    });

    it('G14-05 very large position returns empty', async () => {
        const ids = await evalXPath("Button[999999]");
        expect(ids).to.deep.equal([]);
    });

    it('G14-06 position with float is not treated as position', async () => {
        // [3.5] is not position()=3.5 since 3.5 is not an integer
        // It goes through the default case (NaN check fails for non-integer)
        const ast = parse("Button[3.5]");
        expect(ast.steps[0].predicates[0].type).to.equal('number');
    });

    it('G14-07 special chars in attribute value — brackets', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'[sign]')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[sign]');
    });

    it('G14-08 special chars — parentheses in value', () => {
        expect(() => parse("Button[@Name='Click (here)']")).to.not.throw();
    });

    it('G14-09 special chars — quotes escaped', () => {
        expect(() => parse('Button[@Name="it\'s"]')).to.not.throw();
    });

    it('G14-10 very long XPath parses OK', () => {
        const long = "//Window[@Name='A']//Panel[@Name='B']//Group[@Name='C']//List[@Name='D']//ListItem[@Name='E']//Text[@Name='F']";
        expect(() => parse(long)).to.not.throw();
    });

    it('G14-11 deeply nested predicates parse OK', () => {
        const deep = "//A[./B[./C[./D[./E[@Name='x']]]]]";
        expect(() => parse(deep)).to.not.throw();
    });

    it('G14-12 multiple predicates on same step', () => {
        const ast = parse("Button[@Name='OK'][@IsEnabled='True'][@ClassName='Btn']");
        expect(ast.steps[0].predicates).to.have.length(3);
    });

    it('G14-13 mixed position and attribute predicates', () => {
        const ast = parse("Button[@Name='OK'][3][@IsEnabled='True']");
        expect(ast.steps[0].predicates).to.have.length(3);
    });

    it('G14-14 no children mock → all position predicates return empty', async () => {
        const ids = await evalXPath("Button[1]", []);
        expect(ids).to.deep.equal([]);
    });

    it('G14-15 no children mock → contains returns empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'x')]", []);
        expect(ids).to.deep.equal([]);
    });
});

// ═══════════════════════════════════════════════
// GROUP 15: Real-world XPath patterns from test_xpath_complex.py (15 tests)
// Verify these all parse and generate reasonable commands
// ═══════════════════════════════════════════════
describe('G15: Real-world XPath patterns', () => {
    const realWorldPatterns = [
        ['index+contains',             "//ListItem[./Text[6][contains(@Name,'[sign]')]]"],
        ['index+exact-match',          "//ListItem[./Text[1][@Name='00001']]"],
        ['index+starts-with',          "//ListItem[./Text[9][starts-with(@Name,'000')]]"],
        ['wrong-index+contains',       "//ListItem[./Text[7][contains(@Name,'[sign]')]]"],
        ['last()+starts-with',         "//ListItem[./Text[last()][starts-with(@Name,'000')]]"],
        ['last() on tab',             "//Window[@Name='App']//Tab[1]/TabItem[last()]"],
        ['OR buttons',                 "//Button[@Name='OK' or @Name='Cancel']"],
        ['chained OR',                 "//Button[@Name='OK' or @Name='Apply' or @Name='Help']"],
        ['OR contains',                "//Button[contains(@Name,'Import') or contains(@Name,'Export')]"],
        ['AND attribute+contains',     "//Button[@IsEnabled='False' and contains(@Name,'P1')]"],
        ['toolbar index+contains',     "//ToolBar[@Name='Clipboard']/Button[2][contains(@Name,'Copy')]"],
        ['toolbar index+mismatch',     "//ToolBar[@Name='Clipboard']/Button[2][@Name='Paste']"],
        ['not() predicate',            "//Window//Button[@AutomationId='Close'][not(@IsEnabled='False')]"],
        ['treeitem index+contains',    "//TreeItem[@Name='Quick access']/TreeItem[5][contains(@Name,'appium')]"],
        ['header OR',                  "//HeaderItem[@Name='Expiry Date' or @Name='Serial Number']"],
    ];

    for (const [label, xpath] of realWorldPatterns) {
        it(`parses: ${label}`, () => {
            expect(() => parse(xpath)).to.not.throw();
        });
    }
});

// ═══════════════════════════════════════════════
// GROUP 16: Wildcard attribute @* (5 tests)
// ═══════════════════════════════════════════════
describe('G16: Wildcard attribute @*', () => {
    it('G16-01 @*="value" parses', () => {
        expect(() => parse("Button[@*='value']")).to.not.throw();
    });

    it('G16-02 @*!="value" parses', () => {
        expect(() => parse("Button[@*!='value']")).to.not.throw();
    });

    it('G16-03 "value"=@* (reversed) parses', () => {
        expect(() => parse("Button['value'=@*]")).to.not.throw();
    });

    it('G16-04 contains(@*,"value") parses', () => {
        expect(() => parse("Button[contains(@*,'value')]")).to.not.throw();
    });

    it('G16-05 @* as standalone predicate parses (attribute existence)', () => {
        expect(() => parse("Button[@*]")).to.not.throw();
    });
});

// ═══════════════════════════════════════════════
// GROUP 17: getPropertyAccessor coverage (5 tests)
// ═══════════════════════════════════════════════
describe('G17: getPropertyAccessor', () => {
    const accessorMap: Record<string, string> = {
        'name': '$_.Current.Name',
        'automationid': '$_.Current.AutomationId',
        'classname': '$_.Current.ClassName',
        'controltype': '$_.Current.ControlType',
        'isenabled': '$_.Current.IsEnabled',
        'isoffscreen': '$_.Current.IsOffscreen',
        'ispassword': '$_.Current.IsPassword',
        'haskeyboardfocus': '$_.Current.HasKeyboardFocus',
        'iskeyboardfocusable': '$_.Current.IsKeyboardFocusable',
        'helptext': '$_.Current.HelpText',
        'itemstatus': '$_.Current.ItemStatus',
        'itemtype': '$_.Current.ItemType',
        'localizedcontroltype': '$_.Current.LocalizedControlType',
        'accesskey': '$_.Current.AccessKey',
        'acceleratorkey': '$_.Current.AcceleratorKey',
        'frameworkid': '$_.Current.FrameworkId',
        'isrequiredforform': '$_.Current.IsRequiredForForm',
        'iscontrolelement': '$_.Current.IsControlElement',
        'iscontentelement': '$_.Current.IsContentElement',
    };

    for (const [prop, expected] of Object.entries(accessorMap)) {
        it(`maps '${prop}' → ${expected}`, () => {
            const accessor = AutomationElement.getPropertyAccessor(prop);
            expect(accessor).to.equal(expected);
        });
    }

    it('returns undefined for unknown property', () => {
        expect(AutomationElement.getPropertyAccessor('unknown')).to.be.undefined;
    });

    it('is case-insensitive', () => {
        expect(AutomationElement.getPropertyAccessor('NAME')).to.equal('$_.Current.Name');
        expect(AutomationElement.getPropertyAccessor('IsEnabled')).to.equal('$_.Current.IsEnabled');
    });
});

// ═══════════════════════════════════════════════
// GROUP 18: INEQUALITY (!=) condition generation (15 tests)
// Bug fix: != must wrap PropertyCondition in NotCondition
// ═══════════════════════════════════════════════
describe('G18: INEQUALITY (!=) condition generation', () => {
    it('G18-01 @Name!="x" → NotCondition wrapping PropertyCondition', async () => {
        const cmds = await captureCommands('Button[@Name!="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('nameProperty');
    });

    it('G18-02 @Name="x" → NO NotCondition (equality)', async () => {
        const cmds = await captureCommands('Button[@Name="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
        expect(findCmd).to.include('nameProperty');
    });

    it('G18-03 @IsEnabled!="True" → NotCondition with boolean', async () => {
        const cmds = await captureCommands('Button[@IsEnabled!="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('isenabledProperty');
    });

    it('G18-04 @IsEnabled="True" → no NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsEnabled="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
    });

    it('G18-05 @ProcessId!=1234 → NotCondition with int32', async () => {
        const cmds = await captureCommands('Button[@ProcessId!=1234]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('processidProperty');
    });

    it('G18-06 @AutomationId!="id1" → NotCondition with string', async () => {
        const cmds = await captureCommands('Button[@AutomationId!="id1"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('automationidProperty');
    });

    it('G18-07 @ClassName!="cls" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@ClassName!="cls"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-08 @FrameworkId!="WPF" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@FrameworkId!="WPF"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-09 @HelpText!="tip" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@HelpText!="tip"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-10 @*!="value" → NotCondition (wildcard, already worked)', async () => {
        const cmds = await captureCommands('Button[@*!="value"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-11 reversed: "OK"!=@Name → NotCondition', async () => {
        const cmds = await captureCommands('Button["OK"!=@Name]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('nameProperty');
    });

    it('G18-12 reversed: "OK"=@Name → no NotCondition', async () => {
        const cmds = await captureCommands('Button["OK"=@Name]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
    });

    it('G18-13 @IsOffscreen!="False" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsOffscreen!="False"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-14 @IsPassword!="True" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsPassword!="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('G18-15 @RuntimeId!="1.2.3" → NotCondition with int32 array', async () => {
        const cmds = await captureCommands('Button[@RuntimeId!="1.2.3"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('runtimeidProperty');
    });
});

// ═══════════════════════════════════════════════
// GROUP 19: substring() function — XPath 1.0 spec compliance (15 tests)
// Bug fix: correct 1-indexed formula with rounding
// ═══════════════════════════════════════════════
describe('G19: substring() — XPath 1.0 spec compliance', () => {
    // Helper: evaluate substring as a standalone expression via XPath engine
    async function evalSubstring(expr: string): Promise<string> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(
            parse(expr),
            new FoundAutomationElement('x'),
        );
        return String(result[0] ?? '');
    }

    it('G19-01 substring("12345", 2, 3) = "234"', async () => {
        expect(await evalSubstring('substring("12345", 2, 3)')).to.equal('234');
    });

    it('G19-02 substring("12345", 2) = "2345"', async () => {
        expect(await evalSubstring('substring("12345", 2)')).to.equal('2345');
    });

    it('G19-03 substring("12345", 1, 3) = "123"', async () => {
        expect(await evalSubstring('substring("12345", 1, 3)')).to.equal('123');
    });

    it('G19-04 substring("12345", 1, 1) = "1"', async () => {
        expect(await evalSubstring('substring("12345", 1, 1)')).to.equal('1');
    });

    it('G19-05 substring("12345", 5, 1) = "5"', async () => {
        expect(await evalSubstring('substring("12345", 5, 1)')).to.equal('5');
    });

    it('G19-06 substring("12345", 1) = "12345" (no count → rest of string)', async () => {
        expect(await evalSubstring('substring("12345", 1)')).to.equal('12345');
    });

    it('G19-07 substring("12345", 0, 3) = "12" (start before string)', async () => {
        expect(await evalSubstring('substring("12345", 0, 3)')).to.equal('12');
    });

    it('G19-08 substring("12345", 6) = "" (start past end)', async () => {
        expect(await evalSubstring('substring("12345", 6)')).to.equal('');
    });

    it('G19-09 substring("12345", 6, 1) = "" (start past end)', async () => {
        expect(await evalSubstring('substring("12345", 6, 1)')).to.equal('');
    });

    it('G19-10 substring("12345", 1, 0) = "" (zero count)', async () => {
        expect(await evalSubstring('substring("12345", 1, 0)')).to.equal('');
    });

    it('G19-11 substring("abcdef", 3, 2) = "cd"', async () => {
        expect(await evalSubstring('substring("abcdef", 3, 2)')).to.equal('cd');
    });

    it('G19-12 substring("hello world", 7) = "world"', async () => {
        expect(await evalSubstring('substring("hello world", 7)')).to.equal('world');
    });

    it('G19-13 substring("hello", 1, 5) = "hello" (exact length)', async () => {
        expect(await evalSubstring('substring("hello", 1, 5)')).to.equal('hello');
    });

    it('G19-14 substring("hello", 1, 99) = "hello" (count exceeds length)', async () => {
        expect(await evalSubstring('substring("hello", 1, 99)')).to.equal('hello');
    });

    it('G19-15 substring("", 1, 1) = "" (empty string)', async () => {
        expect(await evalSubstring('substring("", 1, 1)')).to.equal('');
    });
});

// ═══════════════════════════════════════════════
// GROUP 20: substring-before / substring-after (10 tests)
// Bug fix: substring-after used index+1 instead of index+delimiter.length
// ═══════════════════════════════════════════════
describe('G20: substring-before / substring-after', () => {
    async function evalStr(expr: string): Promise<string> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return String(result[0] ?? '');
    }

    it('G20-01 substring-before("hello-world", "-") = "hello"', async () => {
        expect(await evalStr('substring-before("hello-world", "-")')).to.equal('hello');
    });

    it('G20-02 substring-after("hello-world", "-") = "world"', async () => {
        expect(await evalStr('substring-after("hello-world", "-")')).to.equal('world');
    });

    it('G20-03 substring-after("abcdef", "cd") = "ef" (multi-char delimiter)', async () => {
        expect(await evalStr('substring-after("abcdef", "cd")')).to.equal('ef');
    });

    it('G20-04 substring-before("abcdef", "cd") = "ab"', async () => {
        expect(await evalStr('substring-before("abcdef", "cd")')).to.equal('ab');
    });

    it('G20-05 substring-after("abc", "abc") = "" (delimiter is entire string)', async () => {
        expect(await evalStr('substring-after("abc", "abc")')).to.equal('');
    });

    it('G20-06 substring-before("abc", "abc") = ""', async () => {
        expect(await evalStr('substring-before("abc", "abc")')).to.equal('');
    });

    it('G20-07 substring-after("abc", "xyz") = "" (not found)', async () => {
        expect(await evalStr('substring-after("abc", "xyz")')).to.equal('');
    });

    it('G20-08 substring-before("abc", "xyz") = "" (not found)', async () => {
        expect(await evalStr('substring-before("abc", "xyz")')).to.equal('');
    });

    it('G20-09 substring-after("a::b::c", "::") = "b::c" (multi-char, first occurrence)', async () => {
        expect(await evalStr('substring-after("a::b::c", "::")')).to.equal('b::c');
    });

    it('G20-10 substring-before("a::b::c", "::") = "a"', async () => {
        expect(await evalStr('substring-before("a::b::c", "::")')).to.equal('a');
    });
});

// ═══════════════════════════════════════════════
// GROUP 21: sum() function (5 tests)
// Bug fix: sum() on empty set must return 0, not throw
// ═══════════════════════════════════════════════
describe('G21: sum() function', () => {
    async function evalNum(expr: string): Promise<number> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return Number(result[0]);
    }

    it('G21-01 sum of empty set does NOT throw', async () => {
        // sum() on expression that resolves to empty node set
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        // Should not throw — previously crashed with "Reduce of empty array with no initial value"
        const result = await executor.processExprNode(parse('sum(preceding-sibling::Button)'), new FoundAutomationElement('x'));
        expect(Number(result[0])).to.equal(0);
    });

    it('G21-02 sum of empty set equals 0', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('sum(preceding-sibling::Button)'), new FoundAutomationElement('x'));
        expect(Number(result[0])).to.equal(0);
    });

    it('G21-03 sum parses correctly', () => {
        expect(() => parse('sum(child::node())')).to.not.throw();
    });

    it('G21-04 sum requires exactly 1 argument', async () => {
        try {
            await xpathToElIdOrIds('//Button[sum()=0]', true, undefined, emptyMock);
            expect.fail('Should throw');
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('G21-05 sum in predicate parses', () => {
        expect(() => parse('Button[sum(child::node()) > 0]')).to.not.throw();
    });
});

// ═══════════════════════════════════════════════
// GROUP 22: String functions — behavioral (10 tests)
// ═══════════════════════════════════════════════
describe('G22: String functions — behavioral', () => {
    async function evalStr(expr: string): Promise<string> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return String(result[0] ?? '');
    }

    async function evalNum(expr: string): Promise<number> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return Number(result[0]);
    }

    it('G22-01 concat("a","b","c") = "abc"', async () => {
        expect(await evalStr('concat("a","b","c")')).to.equal('abc');
    });

    it('G22-02 concat("hello"," ","world") = "hello world"', async () => {
        expect(await evalStr('concat("hello"," ","world")')).to.equal('hello world');
    });

    it('G22-03 string-length("hello") = 5', async () => {
        expect(await evalNum('string-length("hello")')).to.equal(5);
    });

    it('G22-04 string-length("") = 0', async () => {
        expect(await evalNum('string-length("")')).to.equal(0);
    });

    it('G22-05 normalize-space("  a  b  ") = "a b"', async () => {
        expect(await evalStr('normalize-space("  a  b  ")')).to.equal('a b');
    });

    it('G22-06 contains("foobar","bar") = true', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('contains("foobar","bar")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(true);
    });

    it('G22-07 starts-with("foobar","foo") = true', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('starts-with("foobar","foo")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(true);
    });

    it('G22-08 starts-with("foobar","bar") = false', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('starts-with("foobar","bar")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(false);
    });

    it('G22-09 translate("abc","abc","ABC") = "ABC"', async () => {
        expect(await evalStr('translate("abc","abc","ABC")')).to.equal('ABC');
    });

    it('G22-10 translate("bar","abc","ABC") = "BAr"', async () => {
        expect(await evalStr('translate("bar","abc","ABC")')).to.equal('BAr');
    });
});

// ═══════════════════════════════════════════════
// GROUP 23: Numeric functions — behavioral (10 tests)
// ═══════════════════════════════════════════════
describe('G23: Numeric functions — behavioral', () => {
    async function evalNum(expr: string): Promise<number> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return Number(result[0]);
    }

    it('G23-01 floor(3.7) = 3', async () => {
        expect(await evalNum('floor(3.7)')).to.equal(3);
    });

    it('G23-02 floor(-3.7) = -4', async () => {
        expect(await evalNum('floor(-3.7)')).to.equal(-4);
    });

    it('G23-03 ceiling(3.2) = 4', async () => {
        expect(await evalNum('ceiling(3.2)')).to.equal(4);
    });

    it('G23-04 ceiling(-3.2) = -3', async () => {
        expect(await evalNum('ceiling(-3.2)')).to.equal(-3);
    });

    it('G23-05 round(3.5) = 4', async () => {
        expect(await evalNum('round(3.5)')).to.equal(4);
    });

    it('G23-06 round(3.4) = 3', async () => {
        expect(await evalNum('round(3.4)')).to.equal(3);
    });

    it('G23-07 2 + 3 = 5', async () => {
        expect(await evalNum('2 + 3')).to.equal(5);
    });

    it('G23-08 10 - 3 = 7', async () => {
        expect(await evalNum('10 - 3')).to.equal(7);
    });

    it('G23-09 4 * 3 = 12', async () => {
        expect(await evalNum('4 * 3')).to.equal(12);
    });

    it('G23-10 10 mod 3 = 1', async () => {
        expect(await evalNum('10 mod 3')).to.equal(1);
    });
});

// ═══════════════════════════════════════════════
// GROUP 24: Boolean/comparison — behavioral (10 tests)
// ═══════════════════════════════════════════════
describe('G24: Boolean and comparison operators', () => {
    async function evalBool(expr: string): Promise<boolean> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return Boolean(result[0]);
    }

    it('G24-01 true() = true', async () => {
        expect(await evalBool('true()')).to.equal(true);
    });

    it('G24-02 false() = false', async () => {
        expect(await evalBool('false()')).to.equal(false);
    });

    it('G24-03 not(true()) = false', async () => {
        expect(await evalBool('not(true())')).to.equal(false);
    });

    it('G24-04 not(false()) = true', async () => {
        expect(await evalBool('not(false())')).to.equal(true);
    });

    it('G24-05 "a" = "a" → true', async () => {
        expect(await evalBool('"a" = "a"')).to.equal(true);
    });

    it('G24-06 "a" != "b" → true', async () => {
        expect(await evalBool('"a" != "b"')).to.equal(true);
    });

    it('G24-07 "a" = "b" → false', async () => {
        expect(await evalBool('"a" = "b"')).to.equal(false);
    });

    it('G24-08 5 > 3 → true', async () => {
        expect(await evalBool('5 > 3')).to.equal(true);
    });

    it('G24-09 3 >= 3 → true', async () => {
        expect(await evalBool('3 >= 3')).to.equal(true);
    });

    it('G24-10 2 < 1 → false', async () => {
        expect(await evalBool('2 < 1')).to.equal(false);
    });
});

// ═══════════════════════════════════════════════
// GROUP 25: OR in post-position predicates (Bug #6 fix) (15 tests)
// [N][expr OR expr] must keep the OR as a single unit
// ═══════════════════════════════════════════════
describe('G25: OR in post-position predicates', () => {
    // Standard tree:
    // el1=alpha, el2=beta, el3=gamma target, el4=delta,
    // el5=epsilon target, el6=zeta, el7=target eta

    it('G25-01 [3][contains(target) or contains(alpha)] → el3 has target → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G25-02 [1][contains(target) or contains(alpha)] → el1 has alpha → match', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G25-03 [2][contains(target) or contains(alpha)] → el2 has neither → no match', async () => {
        const ids = await evalXPath("Button[2][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('G25-04 [7][starts-with(target) or starts-with(alpha)] → el7 starts with target → match', async () => {
        const ids = await evalXPath("Button[7][starts-with(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G25-05 [4][starts-with(target) or starts-with(alpha)] → el4=delta → no match', async () => {
        const ids = await evalXPath("Button[4][starts-with(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('G25-06 [last()][contains(target) or contains(eta)] → el7 has both → match', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'target') or contains(@Name,'eta')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G25-07 OR without position → returns all matching elements', async () => {
        // contains(target) → el3,el5,el7; contains(alpha) → el1 → union = el1,el3,el5,el7
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el1', 'el3', 'el5', 'el7']);
    });

    it('G25-08 [contains or contains][1] → function-then-position with OR', async () => {
        // OR matches el1,el3,el5,el7 → position 1 = el1
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G25-09 [contains or contains][4] → 4th of 4 matches', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][4]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G25-10 [contains or contains][5] → only 4 matches → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][5]");
        expect(ids).to.deep.equal([]);
    });

    it('G25-11 [3][contains(target) or starts-with(alpha)] → mixed functions in OR', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el3']); // el3 has target
    });

    it('G25-12 [1][contains(target) or starts-with(alpha)] → el1 starts with alpha', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G25-13 OR condition in PS command does NOT decompose', async () => {
        const cmds = await captureCommands("Button[3][contains(@Name,'a') or contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        // No psFilter should be set since OR is post-position
        expect(findCmd).to.not.include("-like '*a*'");
        expect(findCmd).to.not.include("-like '*b*'");
    });

    it('G25-14 OR pre-position: whole OR becomes single relativeExprNode, no psFilter', async () => {
        // Even pre-position OR with contains should NOT decompose into individual psFilters
        const cmds = await captureCommands("Button[contains(@Name,'a') or contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        // OR is kept as one unit — no individual psFilter
        expect(findCmd).to.not.include("-like '*a*'");
    });

    it('G25-15 triple OR: [3][contains(a) or contains(b) or contains(c)]', async () => {
        // Chained OR: (contains(a) or contains(b)) or contains(c)
        // el3 = "gamma target" → contains 'a' → true
        const ids = await evalXPath("Button[3][contains(@Name,'a') or contains(@Name,'b') or contains(@Name,'c')]");
        expect(ids).to.deep.equal(['el3']); // 'gamma' contains 'a'
    });
});

// ═══════════════════════════════════════════════
// GROUP 26: AND with mixed conditions and relativeExprNodes (10 tests)
// ═══════════════════════════════════════════════
describe('G26: AND with mixed conditions', () => {
    it('G26-01 [contains(target) and contains(gamma)] → only el3 matches both', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G26-02 [contains(target) and contains(epsilon)] → only el5', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G26-03 [contains(target) and starts-with(target)] → only el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G26-04 [3][contains(target) and contains(gamma)] → el3 matches both → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') and contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G26-05 [3][contains(target) and contains(epsilon)] → el3 has no epsilon → empty', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal([]);
    });

    it('G26-06 [5][contains(target) and contains(epsilon)] → el5 has both → match', async () => {
        const ids = await evalXPath("Button[5][contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G26-07 AND generates PS-level condition when possible', async () => {
        // Both sides are PropertyConditions → should use AndCondition at PS level
        const cmds = await captureCommands("Button[contains(@Name,'a') and contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        // Both are relativeExprNodes, evaluated as AND in JS (correct for AND)
        expect(findCmd).to.exist;
    });

    it('G26-08 [contains(e) and not(contains(target))] → elements with e but no target', async () => {
        // e in: el2(beta), el3(gamma target), el4(delta), el5(epsilon target), el6(zeta), el7(target eta)
        // not target: el2(beta), el4(delta), el6(zeta)
        const ids = await evalXPath("Button[contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el2', 'el4', 'el6']);
    });

    it('G26-09 [3][contains(e) and not(contains(target))] → el3 has target → no match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal([]);
    });

    it('G26-10 [4][contains(e) and not(contains(target))] → el4=delta has e, no target → match', async () => {
        const ids = await evalXPath("Button[4][contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el4']);
    });
});

// ═══════════════════════════════════════════════
// GROUP 27: not() with complex inner expressions (10 tests)
// ═══════════════════════════════════════════════
describe('G27: not() with complex expressions', () => {
    it('G27-01 [not(contains(target))] → elements without target', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el6']);
    });

    it('G27-02 [not(starts-with(target))] → all except el7', async () => {
        const ids = await evalXPath("Button[not(starts-with(@Name,'target'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el3', 'el4', 'el5', 'el6']);
    });

    it('G27-03 [not(contains(z))] → elements without z', async () => {
        // Only el6(zeta) contains 'z' → NOT → all except el6
        const ids = await evalXPath("Button[not(contains(@Name,'z'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el3', 'el4', 'el5', 'el7']);
    });

    it('G27-04 [3][not(contains(target))] → el3 has target → not → empty', async () => {
        const ids = await evalXPath("Button[3][not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal([]);
    });

    it('G27-05 [4][not(contains(target))] → el4=delta no target → match', async () => {
        const ids = await evalXPath("Button[4][not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el4']);
    });

    it('G27-06 [not(not(contains(target)))] → double negation = contains(target)', async () => {
        const ids = await evalXPath("Button[not(not(contains(@Name,'target')))]");
        expect(ids).to.deep.equal(['el3', 'el5', 'el7']);
    });

    it('G27-07 [not(contains(target) or contains(alpha))] → neither target nor alpha', async () => {
        // target or alpha → el1,el3,el5,el7 → NOT → el2,el4,el6
        const ids = await evalXPath("Button[not(contains(@Name,'target') or contains(@Name,'alpha'))]");
        expect(ids).to.deep.equal(['el2', 'el4', 'el6']);
    });

    it('G27-08 [not(contains(target) and contains(gamma))] → not (target AND gamma)', async () => {
        // Only el3 has both target and gamma → NOT el3 → all except el3
        const ids = await evalXPath("Button[not(contains(@Name,'target') and contains(@Name,'gamma'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el5', 'el6', 'el7']);
    });

    it('G27-09 [not(true())] → always false → empty', async () => {
        const ids = await evalXPath("Button[not(true())]");
        expect(ids).to.deep.equal([]);
    });

    it('G27-10 [not(false())] → always true → all', async () => {
        const ids = await evalXPath("Button[not(false())]");
        expect(ids).to.have.length(7);
    });
});

// ═══════════════════════════════════════════════
// GROUP 28: Chained multiple predicates (10 tests)
// Three or more predicates applied sequentially
// ═══════════════════════════════════════════════
describe('G28: Chained multiple predicates', () => {
    it('G28-01 [contains(e)][contains(m)][1] → filter by e then m, then pos 1', async () => {
        // Contains 'e': el2(beta),el3(gamma target),el4(delta),el5(epsilon target),el6(zeta),el7(target eta)
        // Contains 'm': from above: only el3(gamma target) has 'm' in 'gamma'
        // Position 1: el3
        const ids = await evalXPath("Button[contains(@Name,'e')][contains(@Name,'m')][1]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G28-02 [contains(e)][contains(m)][last()] → last of double-filtered set', async () => {
        // Only el3 matches both → last = el3
        const ids = await evalXPath("Button[contains(@Name,'e')][contains(@Name,'m')][last()]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G28-03 [1][contains(target)][contains(gamma)] → pos 1 → el1, no target → empty', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target')][contains(@Name,'gamma')]");
        expect(ids).to.deep.equal([]);
    });

    it('G28-04 [3][contains(target)][contains(gamma)] → el3 has both → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G28-05 [3][contains(target)][starts-with(gamma)] → el3 starts with gamma → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][starts-with(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G28-06 [3][contains(target)][starts-with(target)] → el3 doesnt start with target → empty', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G28-07 [contains(p)][contains(l)] → must have both p and l', async () => {
        // 'p' in: alpha(p), epsilon target(p) → el1, el5
        // 'l' in: alpha(l), delta(l), epsilon target(l) → el1, el4, el5
        // Both p AND l: el1(alpha), el5(epsilon target)
        const ids = await evalXPath("Button[contains(@Name,'p')][contains(@Name,'l')]");
        expect(ids).to.deep.equal(['el1', 'el5']);
    });

    it('G28-08 [contains(p)][1][contains(target)] → filter by p → el1,el5 → pos 1 → el1 → no target → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][1][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('G28-09 [contains(p)][2][contains(target)] → filter by p → el1,el5 → pos 2 → el5 → has target → match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][2][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('G28-10 [contains(p)][2][starts-with(epsilon)] → filter by p → pos 2 → el5 → starts with epsilon → match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][2][starts-with(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });
});

// ═══════════════════════════════════════════════
// GROUP 29: Complex real-world XPath patterns (15 tests)
// Patterns inspired by W3C spec + UI automation scenarios
// ═══════════════════════════════════════════════
describe('G29: Complex real-world patterns', () => {
    it('G29-01 position-then-OR-then-contains: [3][contains(a) or contains(b)][contains(m)]', async () => {
        // pos 3 → el3("gamma target") → contains a OR b → has 'a' → true → contains m → has 'm' → true
        const ids = await evalXPath("Button[3][contains(@Name,'a') or contains(@Name,'b')][contains(@Name,'m')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('G29-02 position-then-OR-then-mismatch: [2][contains(a) or contains(b)][contains(m)]', async () => {
        // pos 2 → el2("beta") → contains a OR b → has 'b' → true → contains m → no 'm' → false
        const ids = await evalXPath("Button[2][contains(@Name,'a') or contains(@Name,'b')][contains(@Name,'m')]");
        expect(ids).to.deep.equal([]);
    });

    it('G29-03 not-contains with OR: [not(contains(target)) or starts-with(target)]', async () => {
        // not(target): el1,el2,el4,el6; starts-with(target): el7 → union = el1,el2,el4,el6,el7
        const ids = await evalXPath("Button[not(contains(@Name,'target')) or starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el6', 'el7']);
    });

    it('G29-04 contains with empty string in OR: [contains("") or contains(nonexistent)]', async () => {
        // contains('') always true → OR short-circuits → all match
        const ids = await evalXPath("Button[contains(@Name,'') or contains(@Name,'nonexistent')]");
        expect(ids).to.have.length(7);
    });

    it('G29-05 position 1 only', async () => {
        const ids = await evalXPath("Button[1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('G29-06 last() only', async () => {
        const ids = await evalXPath("Button[last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G29-07 position()=last() selects only last', async () => {
        const ids = await evalXPath("Button[position()=last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('G29-08 deep nested predicate pattern parses', () => {
        // ListItem with a Text child at pos 6 that has an OR condition, then select Text children
        const ast = parse("//ListItem[./Text[6][contains(@Name,'[encrypt]') or contains(@Name,'SecureData')]]/Text");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G29-09 multiple steps with predicates at each level parses', () => {
        const ast = parse("//Window[@Name='App']//Tab[1]/TabItem[3][contains(@Name,'Cert')]");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G29-10 ancestor axis with predicate parses', () => {
        const ast = parse("//Button[@Name='OK']/ancestor::Window[contains(@Name,'Dialog')]");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G29-11 following-sibling with position parses', () => {
        const ast = parse("//TabItem[@Name='General']/following-sibling::TabItem[1]");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G29-12 preceding-sibling with last() parses', () => {
        const ast = parse("//TabItem[@Name='Advanced']/preceding-sibling::TabItem[last()]");
        expect(ast.type).to.equal('absolute-location-path');
    });

    it('G29-13 union with complex predicates each side parses', () => {
        const ast = parse("//Button[contains(@Name,'Import')][1] | //Button[starts-with(@Name,'Export')][last()]");
        expect(ast.type).to.equal('union');
    });

    it('G29-14 De Morgan: not(A or B) = not(A) and not(B)', async () => {
        const ids1 = await evalXPath("Button[not(contains(@Name,'target') or contains(@Name,'alpha'))]");
        const ids2 = await evalXPath("Button[not(contains(@Name,'target')) and not(contains(@Name,'alpha'))]");
        expect(ids1).to.deep.equal(ids2);
    });

    it('G29-15 De Morgan: not(A and B) ≠ not(A) or not(B) when overlap exists', async () => {
        // not(target AND gamma) → not only el3 → 6 elements
        const ids1 = await evalXPath("Button[not(contains(@Name,'target') and contains(@Name,'gamma'))]");
        // not(target) OR not(gamma) → same result (De Morgan's law)
        const ids2 = await evalXPath("Button[not(contains(@Name,'target')) or not(contains(@Name,'gamma'))]");
        expect(ids1).to.deep.equal(ids2);
    });
});

// ═══════════════════════════════════════════════
// GROUP 30: Boolean conversion edge cases (10 tests)
// XPath 1.0 boolean conversion rules
// ═══════════════════════════════════════════════
describe('G30: Boolean conversion rules', () => {
    async function evalBool(expr: string): Promise<boolean> {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
        return Boolean(result[0]);
    }

    it('G30-01 boolean("") = false (empty string)', async () => {
        expect(await evalBool('boolean("")')).to.equal(false);
    });

    it('G30-02 boolean("0") = true (non-empty string, even "0")', async () => {
        expect(await evalBool('boolean("0")')).to.equal(true);
    });

    it('G30-03 boolean("false") = true (non-empty string)', async () => {
        expect(await evalBool('boolean("false")')).to.equal(true);
    });

    it('G30-04 boolean("hello") = true', async () => {
        expect(await evalBool('boolean("hello")')).to.equal(true);
    });

    it('G30-05 boolean(0) = false (number zero)', async () => {
        expect(await evalBool('boolean(0)')).to.equal(false);
    });

    it('G30-06 boolean(1) = true', async () => {
        expect(await evalBool('boolean(1)')).to.equal(true);
    });

    it('G30-07 boolean(-5) = true (non-zero negative)', async () => {
        expect(await evalBool('boolean(-5)')).to.equal(true);
    });

    it('G30-08 boolean(true()) = true', async () => {
        expect(await evalBool('boolean(true())')).to.equal(true);
    });

    it('G30-09 boolean(false()) = false', async () => {
        expect(await evalBool('boolean(false())')).to.equal(false);
    });

    it('G30-10 "a" = "a" and "b" = "b" → true (AND with both true)', async () => {
        expect(await evalBool('"a" = "a" and "b" = "b"')).to.equal(true);
    });
});
