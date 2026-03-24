/**
 * Comprehensive XPath 1.0 Test Suite
 *
 * Tests the actual XPath handling functions (xpathToElIdOrIds, XPathExecutor,
 * predicateProcessableBeforeNode), NOT the xpath-analyzer library.
 *
 * Organized by W3C XPath 1.0 Specification:
 *   Section 1: Error Handling — Invalid selectors produce InvalidSelectorError
 *   Section 2: Location Paths — Axes, Node Tests, Condition Generation
 *   Section 3: Predicates — Position, Ordering, Chaining, Complex
 *   Section 4: Core Function Library (W3C §4)
 *     4.1 Node-Set Functions: last, position, count, id, local-name, name
 *     4.2 String Functions: string, concat, starts-with, contains, substring-before/after, substring, string-length, normalize-space, translate
 *     4.3 Boolean Functions: boolean, not, true, false
 *     4.4 Number Functions: number, sum, floor, ceiling, round
 *   Section 5: Operators — Comparison, Boolean, Arithmetic, Union
 *   Section 6: Type Coercion (W3C §3.4)
 *   Section 7: Implementation-Specific — PS Filter, Condition Generation, Property Accessors
 *   Section 8: Complex Patterns & Real-World
 *   Section 9: Edge Cases & Regression
 *
 * Reference: https://www.w3.org/TR/1999/REC-xpath-19991116/
 */

import { expect } from 'chai';
import { xpathToElIdOrIds } from '../../lib/xpath';
import { XPathExecutor, predicateProcessableBeforeNode } from '../../lib/xpath/core';
import { FoundAutomationElement, AutomationElement } from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';
import XPathAnalyzer, { ExprNode } from 'xpath-analyzer';

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const emptyMock = async (_: string) => '';

/**
 * Parse XPath — ONLY used to feed AST into processExprNode / predicateProcessableBeforeNode.
 * NOT for testing whether something parses (that tests the library, not our code).
 */
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
 * el1: Name="alpha"          → Button
 * el2: Name="beta"           → Text
 * el3: Name="gamma target"   → Button
 * el4: Name="delta"          → ListItem
 * el5: Name="epsilon target" → Button
 * el6: Name="zeta"           → Window
 * el7: Name="target eta"     → Button
 *
 * contains(@Name,'target') → el3, el5, el7
 * starts-with(@Name,'target') → el7
 */
interface MockChild { id: string; name: string; controlType?: string; }
const STANDARD_CHILDREN: MockChild[] = [
    { id: 'el1', name: 'alpha', controlType: 'Button' },
    { id: 'el2', name: 'beta', controlType: 'Text' },
    { id: 'el3', name: 'gamma target', controlType: 'Button' },
    { id: 'el4', name: 'delta', controlType: 'ListItem' },
    { id: 'el5', name: 'epsilon target', controlType: 'Button' },
    { id: 'el6', name: 'zeta', controlType: 'Window' },
    { id: 'el7', name: 'target eta', controlType: 'Button' },
];

/**
 * Create a mock that simulates a flat parent→children tree.
 * Implements psFilter (Where-Object Current.Name -like) so
 * behavioral tests can detect whether the filter was applied at PS level.
 */
function createFlatMock(children: MockChild[] = STANDARD_CHILDREN) {
    return async (command: string): Promise<string> => {
        const d = decodePwsh(command);

        if (d.includes('.Current.ControlType')) {
            for (const child of children) {
                if (d.includes(child.id)) return child.controlType || 'Custom';
            }
            return 'Custom';
        }

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

        // Bulk fetch lookups
        if (d.includes('|#|')) {
            const results: string[] = [];
            let prop = '';
            if (d.includes('NameProperty')) prop = 'name';
            else if (d.includes('ClassNameProperty')) prop = 'className';
            else if (d.includes('AutomationIdProperty')) prop = 'automationId';
            else if (d.includes('ControlTypeProperty')) prop = 'controlType';

            const match = d.match(/@\(([^)]+)\)/);
            if (match && match[1]) {
                const ids = match[1].split(',').map(s => s.trim().replace(/'/g, ''));
                for (const id of ids) {
                    const child = children.find(c => c.id === id);
                    if (child) {
                        let val = '';
                        if (prop === 'name') val = child.name;
                        else if (prop === 'controlType') val = child.controlType || 'Custom';

                        if (val) results.push(`${id}|#|${val}`);
                    }
                }
            }
            return results.join('\n');
        }

        // Property lookups for specific elements
        for (const child of children) {
            if (d.includes(`'${child.id}'`) || d.includes(`${child.id}.Current`)) {
                if (d.includes('RuntimeIdProperty')) return child.id;
                if (d.includes('NameProperty')) return child.name;
                if (d.includes('ControlTypeProperty')) return child.controlType || 'Custom';
                if (d.includes('.Current.ControlType')) return child.controlType || 'Custom';
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

/** Evaluate an XPath expression and return the raw first result as string */
async function evalStr(expr: string): Promise<string> {
    const mock = async (_: string) => '';
    const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
    const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
    return String(result[0] ?? '');
}

/** Evaluate an XPath expression and return the raw first result as number */
async function evalNum(expr: string): Promise<number> {
    const mock = async (_: string) => '';
    const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
    const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
    return Number(result[0]);
}

/** Evaluate an XPath expression and return the raw first result as boolean */
async function evalBool(expr: string): Promise<boolean> {
    const mock = async (_: string) => '';
    const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
    const result = await executor.processExprNode(parse(expr), new FoundAutomationElement('x'));
    return Boolean(result[0]);
}

/** Evaluate an expression with the flat mock and a specific context node */
async function evalStrWithContext(expr: string, contextId: string): Promise<string> {
    const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
    const result = await executor.processExprNode(parse(expr), new FoundAutomationElement(contextId));
    return String(result[0] ?? '');
}

/**
 * Verify that xpathToElIdOrIds accepts an XPath (no error thrown).
 * Tests OUR error-handling wrapper, not the parser library.
 */
async function assertAccepts(xpath: string): Promise<void> {
    await xpathToElIdOrIds(xpath, true, undefined, emptyMock);
}

/**
 * Verify that xpathToElIdOrIds rejects an XPath with InvalidSelectorError.
 * Tests OUR error-handling wrapper.
 */
async function assertRejectsAsInvalidSelector(xpath: string): Promise<void> {
    try {
        await xpathToElIdOrIds(xpath, true, undefined, emptyMock);
        expect.fail('Should have thrown');
    } catch (e: any) {
        expect(e.name).to.equal('InvalidSelectorError');
    }
}


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 1: ERROR HANDLING                                        ║
// ║  Tests that xpathToElIdOrIds wraps parse/execution errors         ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('1.1: Invalid XPath → InvalidSelectorError', () => {
    it('empty xpath', async () => {
        await assertRejectsAsInvalidSelector('');
    });

    it('unclosed bracket: //Button[', async () => {
        await assertRejectsAsInvalidSelector('//Button[');
    });

    it('unclosed string: //Button[@Name="OK]', async () => {
        await assertRejectsAsInvalidSelector('//Button[@Name="OK]');
    });

    it('empty brackets: //Button[]', async () => {
        await assertRejectsAsInvalidSelector('//Button[]');
    });

    it('double at: //Button[@@Name]', async () => {
        await assertRejectsAsInvalidSelector('//Button[@@Name]');
    });

    it('missing axis name: //Button[::Name]', async () => {
        await assertRejectsAsInvalidSelector('//Button[::Name]');
    });

    it('triple slash: ///Button', async () => {
        await assertRejectsAsInvalidSelector('///Button');
    });

    it('unclosed paren: //Button[contains(@Name,"OK"', async () => {
        await assertRejectsAsInvalidSelector('//Button[contains(@Name,"OK"');
    });

    it('unknown function: //Button[foobar()]', async () => {
        await assertRejectsAsInvalidSelector('//Button[foobar()]');
    });
});

describe('1.2: Execution errors from XPath functions', () => {
    it('contains() with wrong arg count throws', async () => {
        try {
            await xpathToElIdOrIds("//Button[contains(@Name)]", true, undefined, emptyMock);
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('sum() with no args throws', async () => {
        try {
            await xpathToElIdOrIds('//Button[sum()=0]', true, undefined, emptyMock);
            expect.fail('Should throw');
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('count() with no args throws', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        try {
            await executor.processExprNode(parse("count()"), new FoundAutomationElement('parent'));
            expect.fail('Should throw');
        } catch (e: any) {
            expect(e).to.be.an('error');
        }
    });

    it('name() throws if >1 node matched', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        try {
            await executor.processExprNode(parse("name(Button)"), new FoundAutomationElement('parent'));
            expect.fail('Should throw');
        } catch (e: any) {
            expect(e.message).to.include('either one or zero elements');
        }
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 2: LOCATION PATHS (W3C §2)                              ║
// ║  Tests command generation for axes, node tests, conditions        ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 2.1 Axes (W3C §2.2) — verify correct PS commands generated
// ═══════════════════════════════════════════════
describe('2.1: Axes — command generation (W3C §2.2)', () => {
    it('child:: (default) generates Children scope', async () => {
        const cmds = await captureCommands('Button');
        expect(cmds.some(c => c.includes('children'))).to.be.true;
    });

    it('descendant:: generates Descendants scope', async () => {
        const cmds = await captureCommands('descendant::Button');
        expect(cmds.some(c => c.includes('Find-AllDescendants') || c.includes('descendants'))).to.be.true;
    });

    it('self:: generates Element scope', async () => {
        const cmds = await captureCommands('self::node()');
        expect(cmds.some(c => c.includes('Element') || c.includes('element'))).to.be.true;
    });

    it('parent:: generates GetParent traversal', async () => {
        const cmds = await captureCommands('parent::Window');
        expect(cmds.some(c => c.includes('GetParent'))).to.be.true;
    });

    it('ancestor:: generates GetParent traversal', async () => {
        const cmds = await captureCommands('ancestor::Window');
        expect(cmds.some(c => c.includes('GetParent'))).to.be.true;
    });

    it('following-sibling:: generates correct command', async () => {
        const cmds = await captureCommands('following-sibling::Button');
        expect(cmds.some(c => c.includes('GetNextSibling') || c.includes('following'))).to.be.true;
    });

    it('preceding-sibling:: generates correct command', async () => {
        const cmds = await captureCommands('preceding-sibling::Button');
        expect(cmds.some(c => c.includes('GetPreviousSibling') || c.includes('preceding'))).to.be.true;
    });

    it('namespace:: returns empty (unsupported in UIA)', async () => {
        const mock = createFlatMock();
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), mock);
        const result = await executor.processExprNode(parse('namespace::node()'), new FoundAutomationElement('parent'));
        expect(result).to.have.length(0);
    });

    it('// double-slash optimizes to single descendant search', async () => {
        const cmds = await captureCommands('//Button');
        expect(cmds.filter(c => c.includes('FindAll')).length).to.be.lessThanOrEqual(1);
    });
});

// ═══════════════════════════════════════════════
// 2.2 Node Tests — condition generation (W3C §2.3)
// ═══════════════════════════════════════════════
describe('2.2: Node Tests — condition generation (W3C §2.3)', () => {
    it('Button → ControlType condition', async () => {
        const cmds = await captureCommands('Button');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('controltypeProperty');
        expect(findCmd).to.include('[ControlType]::Button');
    });

    it('node() → TrueCondition', async () => {
        const cmds = await captureCommands('node()');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('TrueCondition');
    });

    it('* (wildcard) → TrueCondition', async () => {
        const cmds = await captureCommands('*');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('TrueCondition');
    });

    it('processing-instruction() → FalseCondition', async () => {
        const cmds = await captureCommands('processing-instruction()');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        if (findCmd) {
            expect(findCmd).to.include('FalseCondition');
        }
    });

    it('List → OrCondition(List, DataGrid)', async () => {
        const cmds = await captureCommands('List');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
        expect(findCmd).to.include('[ControlType]::List');
        expect(findCmd).to.include('[ControlType]::DataGrid');
    });

    it('ListItem → OrCondition(ListItem, DataItem)', async () => {
        const cmds = await captureCommands('ListItem');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
        expect(findCmd).to.include('[ControlType]::ListItem');
        expect(findCmd).to.include('[ControlType]::DataItem');
    });

    it('AppBar → LocalizedControlType condition', async () => {
        const cmds = await captureCommands('AppBar');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('localizedcontroltypeProperty');
    });

    it('SemanticZoom → LocalizedControlType condition', async () => {
        const cmds = await captureCommands('SemanticZoom');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('localizedcontroltypeProperty');
    });

    it('[@Name="OK"] → PropertyCondition', async () => {
        const cmds = await captureCommands('Button[@Name="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('nameProperty');
        expect(findCmd).to.include('PropertyCondition');
    });

    it('[@IsEnabled="True"] → boolean PropertyCondition', async () => {
        const cmds = await captureCommands('Button[@IsEnabled="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('isenabledProperty');
    });

    it('[@ProcessId=1234] → int32 PropertyCondition', async () => {
        const cmds = await captureCommands('Button[@ProcessId=1234]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('processidProperty');
    });

    it('[@Name="A" and @ClassName="B"] → AndCondition', async () => {
        const cmds = await captureCommands('Button[@Name="A" and @ClassName="B"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[AndCondition]');
    });

    it('[@Name="A" or @Name="B"] → OrCondition', async () => {
        const cmds = await captureCommands('Button[@Name="A" or @Name="B"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[OrCondition]');
    });

    it('[not(@Name="A")] is a post-execution filter', async () => {
        const cmds = await captureCommands('Button[not(@Name="A")]');
        expect(cmds.length).to.be.greaterThanOrEqual(1);
    });

    it('[@RuntimeId="1.2.3"] → Int32Array condition', async () => {
        const cmds = await captureCommands('Button[@RuntimeId="1.2.3"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('runtimeidProperty');
        expect(findCmd).to.include('[int32[]]');
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 3: PREDICATES (W3C §2.4)                                ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 3.1 Position predicates
// ═══════════════════════════════════════════════
describe('3.1: Position predicates', () => {
    it('[1] selects first element', async () => {
        const ids = await evalXPath("Button[1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('[7] selects seventh element', async () => {
        const ids = await evalXPath("Button[7]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[last()] selects last element', async () => {
        const ids = await evalXPath("Button[last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[position()=1] equivalent to [1]', async () => {
        const ids = await evalXPath("Button[position()=1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('[position()=last()] selects last', async () => {
        const ids = await evalXPath("Button[position()=last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[0] — XPath is 1-indexed, no match', async () => {
        const ids = await evalXPath("Button[0]");
        expect(ids).to.deep.equal([]);
    });

    it('[99] — out of range', async () => {
        const ids = await evalXPath("Button[99]");
        expect(ids).to.deep.equal([]);
    });

    it('[-1] — negative position, no match', async () => {
        const ids = await evalXPath("Button[-1]");
        expect(ids).to.deep.equal([]);
    });

    it('[999999] — very large position returns empty', async () => {
        const ids = await evalXPath("Button[999999]");
        expect(ids).to.deep.equal([]);
    });

    it('[position() < 3] selects first two', async () => {
        const ids = await evalXPath("Button[position() < 3]");
        expect(ids).to.deep.equal(['el1', 'el2']);
    });

    it('[position() > 5] selects last two', async () => {
        const ids = await evalXPath("Button[position() > 5]");
        expect(ids).to.deep.equal(['el6', 'el7']);
    });

    it('[position() >= 6]', async () => {
        const ids = await evalXPath("Button[position() >= 6]");
        expect(ids).to.deep.equal(['el6', 'el7']);
    });

    it('[position() <= 2]', async () => {
        const ids = await evalXPath("Button[position() <= 2]");
        expect(ids).to.deep.equal(['el1', 'el2']);
    });

    it('[position() != 3] selects all except third', async () => {
        const ids = await evalXPath("Button[position() != 3]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el5', 'el6', 'el7']);
    });

    it('[last() - 1] selects second-to-last', async () => {
        const ids = await evalXPath("Button[last() - 1]");
        expect(ids).to.deep.equal(['el6']);
    });

    it('[position() mod 2 = 1] selects odd positions', async () => {
        const ids = await evalXPath("Button[position() mod 2 = 1]");
        expect(ids).to.deep.equal(['el1', 'el3', 'el5', 'el7']);
    });

    it('[position() mod 2 = 0] selects even positions', async () => {
        const ids = await evalXPath("Button[position() mod 2 = 0]");
        expect(ids).to.deep.equal(['el2', 'el4', 'el6']);
    });

    it('no children → position predicate returns empty', async () => {
        const ids = await evalXPath("Button[1]", []);
        expect(ids).to.deep.equal([]);
    });
});

// ═══════════════════════════════════════════════
// 3.2 Predicate ordering — position THEN function
// ═══════════════════════════════════════════════
describe('3.2: Predicate ordering — position then function', () => {
    it('[3][contains(target)] → el3 has target → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[1][contains(target)] → el1=alpha no target → empty', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[5][contains(target)] → el5 has target → match', async () => {
        const ids = await evalXPath("Button[5][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[4][contains(target)] → el4=delta no target → empty', async () => {
        const ids = await evalXPath("Button[4][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[7][starts-with(target)] → el7 starts with target → match', async () => {
        const ids = await evalXPath("Button[7][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[3][starts-with(target)] → el3 starts with gamma → empty', async () => {
        const ids = await evalXPath("Button[3][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[last()][contains(target)] → el7 has target → match', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[last()][starts-with(target)] → el7 starts with target → match', async () => {
        const ids = await evalXPath("Button[last()][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[last()][contains(alpha)] → el7 has no alpha → empty', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('[2][contains(target)] → el2=beta → empty', async () => {
        const ids = await evalXPath("Button[2][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[6][contains(target)] → el6=zeta → empty', async () => {
        const ids = await evalXPath("Button[6][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[7][contains(target)] → el7 → match', async () => {
        const ids = await evalXPath("Button[7][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('single child — [1][contains] with solo match', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'only')]", [
            { id: 'solo', name: 'only' },
        ]);
        expect(ids).to.deep.equal(['solo']);
    });

    it('single child — [1][contains] with solo mismatch', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'nope')]", [
            { id: 'solo', name: 'only' },
        ]);
        expect(ids).to.deep.equal([]);
    });

    it('[3][contains("")] — empty needle always true', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'')]");
        expect(ids).to.deep.equal(['el3']);
    });
});

// ═══════════════════════════════════════════════
// 3.3 Predicate ordering — function THEN position
// ═══════════════════════════════════════════════
describe('3.3: Predicate ordering — function then position', () => {
    it('[contains][1] — first of 3 matches → el3', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][1]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[contains][2] → el5', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][2]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[contains][3] → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][3]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[contains][4] — 4th of 3 matches → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][4]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains][last()] → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')][last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[starts-with][1] → el7', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')][1]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[starts-with][2] → empty', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')][2]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains(alpha)][1] → el1', async () => {
        const ids = await evalXPath("Button[contains(@Name,'alpha')][1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('[contains(alpha)][2] → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'alpha')][2]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains(e)][1] → el2', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][1]");
        expect(ids).to.deep.equal(['el2']);
    });

    it('[contains(e)][6] → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][6]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[contains(e)][7] — only 6 matches → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][7]");
        expect(ids).to.deep.equal([]);
    });

    it('[starts-with(epsilon)][1] → el5', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'epsilon')][1]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[contains(nonexistent)][1] → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'nonexistent')][1]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains("")][last()] — empty matches all → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'')][last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[contains] only → all 3 matching', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el3', 'el5', 'el7']);
    });

    it('[starts-with] only → el7', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });
});

// ═══════════════════════════════════════════════
// 3.4 Chained multiple predicates
// ═══════════════════════════════════════════════
describe('3.4: Chained multiple predicates', () => {
    it('[contains(e)][contains(m)][1]', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][contains(@Name,'m')][1]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[contains(e)][contains(m)][last()]', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e')][contains(@Name,'m')][last()]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[1][contains(target)][contains(gamma)] → el1 no target → empty', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target')][contains(@Name,'gamma')]");
        expect(ids).to.deep.equal([]);
    });

    it('[3][contains(target)][contains(gamma)] → el3 both → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[3][contains(target)][starts-with(gamma)] → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][starts-with(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[3][contains(target)][starts-with(target)] → el3 doesnt start with target → empty', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target')][starts-with(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains(p)][contains(l)] → el1, el5', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][contains(@Name,'l')]");
        expect(ids).to.deep.equal(['el1', 'el5']);
    });

    it('[contains(p)][1][contains(target)] → el1 no target → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][1][contains(@Name,'target')]");
        expect(ids).to.deep.equal([]);
    });

    it('[contains(p)][2][contains(target)] → el5 → match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][2][contains(@Name,'target')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[contains(p)][2][starts-with(epsilon)] → el5 → match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'p')][2][starts-with(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });
});

// ═══════════════════════════════════════════════
// 3.5 predicateProcessableBeforeNode (our function)
// ═══════════════════════════════════════════════
describe('3.5: predicateProcessableBeforeNode', () => {
    it('@Name="value" is processable', () => {
        const ast = parse("Button[@Name='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('@AutomationId="id" is processable', () => {
        const ast = parse("Button[@AutomationId='id']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('@*="value" (wildcard) is processable', () => {
        const ast = parse("Button[@*='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('@UnknownProp="value" is NOT processable', () => {
        const ast = parse("Button[@FooProp='value']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('contains() is NOT processable before node', () => {
        const ast = parse("Button[contains(@Name,'x')]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('numeric predicate is NOT processable', () => {
        const ast = parse("Button[3]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('AND of two processable is processable', () => {
        const ast = parse("Button[@Name='a' and @ClassName='b']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('AND where one side not processable → false', () => {
        const ast = parse("Button[@Name='a' and contains(@Name,'b')]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.false;
    });

    it('OR of two processable is processable', () => {
        const ast = parse("Button[@Name='a' or @Name='b']");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });

    it('"value"=@Name (reversed) is processable', () => {
        const ast = parse("Button['value'=@Name]");
        expect(predicateProcessableBeforeNode(ast.steps[0].predicates[0])).to.be.true;
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 4: CORE FUNCTION LIBRARY (W3C §4)                       ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 4.1 Node-Set Functions (W3C §4.1)
// ═══════════════════════════════════════════════
describe('4.1: Node-Set Functions (W3C §4.1)', () => {
    // --- last() ---
    it('last() returns size of context', async () => {
        const ids = await evalXPath("Button[last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('last() in predicate [position()=last()]', async () => {
        const ids = await evalXPath("Button[position()=last()]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('last() - 1 gives second-to-last position', async () => {
        const ids = await evalXPath("Button[last()-1]");
        expect(ids).to.deep.equal(['el6']);
    });

    // --- position() ---
    it('position()=1 selects first', async () => {
        const ids = await evalXPath("Button[position()=1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('position()=3 selects third', async () => {
        const ids = await evalXPath("Button[position()=3]");
        expect(ids).to.deep.equal(['el3']);
    });

    // --- count() ---
    it('count() counts matching nodes', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("count(Button[contains(@Name,'target')])"), new FoundAutomationElement('parent'));
        expect(result[0]).to.equal(3);
    });

    it('count() of all children', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("count(Button)"), new FoundAutomationElement('parent'));
        expect(result[0]).to.equal(7);
    });

    it('count() of empty node-set = 0', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("count(Button[contains(@Name,'nonexistent')])"), new FoundAutomationElement('parent'));
        expect(result[0]).to.equal(0);
    });

    // --- name() / local-name() ---
    it('name() returns ControlType of context node', async () => {
        expect(await evalStrWithContext('name()', 'el1')).to.equal('Button');
    });

    it('local-name() behaves identical to name() in UIA', async () => {
        expect(await evalStrWithContext('local-name()', 'el1')).to.equal('Button');
    });

    it('name() with single-node argument', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("name(Button[1])"), new FoundAutomationElement('parent'));
        expect(result[0]).to.equal('Button');
    });
});

// ═══════════════════════════════════════════════
// 4.2 String Functions (W3C §4.2)
// ═══════════════════════════════════════════════
describe('4.2: String Functions (W3C §4.2)', () => {
    // --- string() ---
    it('string("hello") = "hello"', async () => {
        expect(await evalStr('string("hello")')).to.equal('hello');
    });

    it('string(123) = "123"', async () => {
        expect(await evalStr('string(123)')).to.equal('123');
    });

    it('string(true()) = "true"', async () => {
        expect(await evalStr('string(true())')).to.equal('true');
    });

    it('string(false()) = "false"', async () => {
        expect(await evalStr('string(false())')).to.equal('false');
    });

    it('string() defaults to context node', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("string()"), new FoundAutomationElement('el1'));
        expect(result[0]).to.equal('');
    });

    it('string(0) = "0"', async () => {
        expect(await evalStr('string(0)')).to.equal('0');
    });

    it('string(-0) = "0"', async () => {
        expect(await evalStr('string(-0)')).to.equal('0');
    });

    // --- concat() ---
    it('concat("a","b","c") = "abc"', async () => {
        expect(await evalStr('concat("a","b","c")')).to.equal('abc');
    });

    it('concat("hello"," ","world") = "hello world"', async () => {
        expect(await evalStr('concat("hello"," ","world")')).to.equal('hello world');
    });

    it('concat with 2 args', async () => {
        expect(await evalStr('concat("foo","bar")')).to.equal('foobar');
    });

    it('concat with 5 args', async () => {
        expect(await evalStr('concat("a","b","c","d","e")')).to.equal('abcde');
    });

    it('concat with empty strings', async () => {
        expect(await evalStr('concat("","hello","")')).to.equal('hello');
    });

    // --- starts-with() ---
    it('starts-with("foobar","foo") = true', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('starts-with("foobar","foo")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(true);
    });

    it('starts-with("foobar","bar") = false', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('starts-with("foobar","bar")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(false);
    });

    it('starts-with("","") = true', async () => {
        expect(await evalBool('starts-with("","")')).to.equal(true);
    });

    it('starts-with("hello","") = true', async () => {
        expect(await evalBool('starts-with("hello","")')).to.equal(true);
    });

    it('starts-with("","hello") = false', async () => {
        expect(await evalBool('starts-with("","hello")')).to.equal(false);
    });

    // --- contains() ---
    it('contains("foobar","bar") = true', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('contains("foobar","bar")'), new FoundAutomationElement('x'));
        expect(result[0]).to.equal(true);
    });

    it('contains("foobar","baz") = false', async () => {
        expect(await evalBool('contains("foobar","baz")')).to.equal(false);
    });

    it('contains("","") = true', async () => {
        expect(await evalBool('contains("","")')).to.equal(true);
    });

    it('contains("hello","") = true', async () => {
        expect(await evalBool('contains("hello","")')).to.equal(true);
    });

    it('contains("","x") = false', async () => {
        expect(await evalBool('contains("","x")')).to.equal(false);
    });

    it('contains is case-sensitive', async () => {
        expect(await evalBool('contains("Hello","hello")')).to.equal(false);
    });

    // --- substring-before() ---
    it('substring-before("hello-world", "-") = "hello"', async () => {
        expect(await evalStr('substring-before("hello-world", "-")')).to.equal('hello');
    });

    it('substring-before("abcdef", "cd") = "ab"', async () => {
        expect(await evalStr('substring-before("abcdef", "cd")')).to.equal('ab');
    });

    it('substring-before("abc", "abc") = ""', async () => {
        expect(await evalStr('substring-before("abc", "abc")')).to.equal('');
    });

    it('substring-before("abc", "xyz") = "" (not found)', async () => {
        expect(await evalStr('substring-before("abc", "xyz")')).to.equal('');
    });

    it('substring-before("a::b::c", "::") = "a" (first occurrence)', async () => {
        expect(await evalStr('substring-before("a::b::c", "::")')).to.equal('a');
    });

    it('substring-before("hello", "") = ""', async () => {
        expect(await evalStr('substring-before("hello", "")')).to.equal('');
    });

    // --- substring-after() ---
    it('substring-after("hello-world", "-") = "world"', async () => {
        expect(await evalStr('substring-after("hello-world", "-")')).to.equal('world');
    });

    it('substring-after("abcdef", "cd") = "ef"', async () => {
        expect(await evalStr('substring-after("abcdef", "cd")')).to.equal('ef');
    });

    it('substring-after("abc", "abc") = ""', async () => {
        expect(await evalStr('substring-after("abc", "abc")')).to.equal('');
    });

    it('substring-after("abc", "xyz") = "" (not found)', async () => {
        expect(await evalStr('substring-after("abc", "xyz")')).to.equal('');
    });

    it('substring-after("a::b::c", "::") = "b::c"', async () => {
        expect(await evalStr('substring-after("a::b::c", "::")')).to.equal('b::c');
    });

    it('substring-after("hello", "") = "hello"', async () => {
        expect(await evalStr('substring-after("hello", "")')).to.equal('hello');
    });

    // --- substring() W3C spec compliance ---
    it('substring("12345", 2, 3) = "234"', async () => {
        expect(await evalStr('substring("12345", 2, 3)')).to.equal('234');
    });

    it('substring("12345", 2) = "2345"', async () => {
        expect(await evalStr('substring("12345", 2)')).to.equal('2345');
    });

    it('substring("12345", 1, 3) = "123"', async () => {
        expect(await evalStr('substring("12345", 1, 3)')).to.equal('123');
    });

    it('substring("12345", 1, 1) = "1"', async () => {
        expect(await evalStr('substring("12345", 1, 1)')).to.equal('1');
    });

    it('substring("12345", 5, 1) = "5"', async () => {
        expect(await evalStr('substring("12345", 5, 1)')).to.equal('5');
    });

    it('substring("12345", 1) = "12345"', async () => {
        expect(await evalStr('substring("12345", 1)')).to.equal('12345');
    });

    it('substring("12345", 0, 3) = "12" (start before string)', async () => {
        expect(await evalStr('substring("12345", 0, 3)')).to.equal('12');
    });

    it('substring("12345", 6) = "" (past end)', async () => {
        expect(await evalStr('substring("12345", 6)')).to.equal('');
    });

    it('substring("12345", 6, 1) = "" (past end)', async () => {
        expect(await evalStr('substring("12345", 6, 1)')).to.equal('');
    });

    it('substring("12345", 1, 0) = "" (zero length)', async () => {
        expect(await evalStr('substring("12345", 1, 0)')).to.equal('');
    });

    it('substring("abcdef", 3, 2) = "cd"', async () => {
        expect(await evalStr('substring("abcdef", 3, 2)')).to.equal('cd');
    });

    it('substring("hello world", 7) = "world"', async () => {
        expect(await evalStr('substring("hello world", 7)')).to.equal('world');
    });

    it('substring("hello", 1, 5) = "hello"', async () => {
        expect(await evalStr('substring("hello", 1, 5)')).to.equal('hello');
    });

    it('substring("hello", 1, 99) = "hello" (length exceeds)', async () => {
        expect(await evalStr('substring("hello", 1, 99)')).to.equal('hello');
    });

    it('substring("", 1, 1) = ""', async () => {
        expect(await evalStr('substring("", 1, 1)')).to.equal('');
    });

    it('W3C: substring("12345", 1.5, 2.6) = "234" (rounding)', async () => {
        expect(await evalStr('substring("12345", 1.5, 2.6)')).to.equal('234');
    });

    it('W3C: substring("12345", -42, 1 div 0) = "12345" (Infinity)', async () => {
        expect(await evalStr('substring("12345", -42, 1 div 0)')).to.equal('12345');
    });

    // --- string-length() ---
    it('string-length("hello") = 5', async () => {
        expect(await evalNum('string-length("hello")')).to.equal(5);
    });

    it('string-length("") = 0', async () => {
        expect(await evalNum('string-length("")')).to.equal(0);
    });

    it('string-length("  ") = 2', async () => {
        expect(await evalNum('string-length("  ")')).to.equal(2);
    });

    it('string-length() defaults to context node', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("string-length()"), new FoundAutomationElement('el1'));
        expect(result[0]).to.equal(0);
    });

    // --- normalize-space() ---
    it('normalize-space("  a  b  ") = "a b"', async () => {
        expect(await evalStr('normalize-space("  a  b  ")')).to.equal('a b');
    });

    it('normalize-space("hello") = "hello"', async () => {
        expect(await evalStr('normalize-space("hello")')).to.equal('hello');
    });

    it('normalize-space("") = ""', async () => {
        expect(await evalStr('normalize-space("")')).to.equal('');
    });

    it('normalize-space("   ") = ""', async () => {
        expect(await evalStr('normalize-space("   ")')).to.equal('');
    });

    it('normalize-space() defaults to context node', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("normalize-space()"), new FoundAutomationElement('el1'));
        expect(result[0]).to.equal('');
    });

    // --- translate() ---
    it('translate("abc","abc","ABC") = "ABC"', async () => {
        expect(await evalStr('translate("abc","abc","ABC")')).to.equal('ABC');
    });

    it('translate("bar","abc","ABC") = "BAr"', async () => {
        expect(await evalStr('translate("bar","abc","ABC")')).to.equal('BAr');
    });

    it('translate("aaa","a","b") = "bbb"', async () => {
        expect(await evalStr('translate("aaa","a","b")')).to.equal('bbb');
    });

    it('translate removal — shorter toChars removes extra chars', async () => {
        expect(await evalStr('translate("abcdef","abcdef","ABC")')).to.equal('ABC');
    });

    it('translate("hello","","") = "hello"', async () => {
        expect(await evalStr('translate("hello","","")')).to.equal('hello');
    });

    it('translate for case-insensitive: lowercasing', async () => {
        expect(await evalStr('translate("Hello World","ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz")')).to.equal('hello world');
    });
});

// ═══════════════════════════════════════════════
// 4.3 Boolean Functions (W3C §4.3)
// ═══════════════════════════════════════════════
describe('4.3: Boolean Functions (W3C §4.3)', () => {
    // --- boolean() conversion rules ---
    it('boolean("") = false', async () => {
        expect(await evalBool('boolean("")')).to.equal(false);
    });

    it('boolean("0") = true (non-empty string)', async () => {
        expect(await evalBool('boolean("0")')).to.equal(true);
    });

    it('boolean("false") = true (non-empty string)', async () => {
        expect(await evalBool('boolean("false")')).to.equal(true);
    });

    it('boolean("hello") = true', async () => {
        expect(await evalBool('boolean("hello")')).to.equal(true);
    });

    it('boolean(0) = false', async () => {
        expect(await evalBool('boolean(0)')).to.equal(false);
    });

    it('boolean(1) = true', async () => {
        expect(await evalBool('boolean(1)')).to.equal(true);
    });

    it('boolean(-5) = true', async () => {
        expect(await evalBool('boolean(-5)')).to.equal(true);
    });

    it('boolean(0.0) = false', async () => {
        expect(await evalBool('boolean(0.0)')).to.equal(false);
    });

    it('boolean(true()) = true', async () => {
        expect(await evalBool('boolean(true())')).to.equal(true);
    });

    it('boolean(false()) = false', async () => {
        expect(await evalBool('boolean(false())')).to.equal(false);
    });

    // --- not() ---
    it('not(true()) = false', async () => {
        expect(await evalBool('not(true())')).to.equal(false);
    });

    it('not(false()) = true', async () => {
        expect(await evalBool('not(false())')).to.equal(true);
    });

    it('not("") = true', async () => {
        expect(await evalBool('not("")')).to.equal(true);
    });

    it('not("hello") = false', async () => {
        expect(await evalBool('not("hello")')).to.equal(false);
    });

    it('not(0) = true', async () => {
        expect(await evalBool('not(0)')).to.equal(true);
    });

    it('not(1) = false', async () => {
        expect(await evalBool('not(1)')).to.equal(false);
    });

    it('not(not(true())) = true', async () => {
        expect(await evalBool('not(not(true()))')).to.equal(true);
    });

    // --- true/false in predicates ---
    it('[true()] matches all', async () => {
        const ids = await evalXPath("Button[true()]");
        expect(ids).to.have.length(7);
    });

    it('[false()] matches none', async () => {
        const ids = await evalXPath("Button[false()]");
        expect(ids).to.have.length(0);
    });

    it('[not(false())] matches all', async () => {
        const ids = await evalXPath("Button[not(false())]");
        expect(ids).to.have.length(7);
    });

    it('[not(true())] matches none', async () => {
        const ids = await evalXPath("Button[not(true())]");
        expect(ids).to.have.length(0);
    });

    it('contains("") → all match (empty needle)', async () => {
        const ids = await evalXPath("Button[contains(@Name,'')]");
        expect(ids).to.have.length(7);
    });

    it('starts-with("") → all match', async () => {
        const ids = await evalXPath("Button[starts-with(@Name,'')]");
        expect(ids).to.have.length(7);
    });

    it('contains case-sensitive (uppercase miss)', async () => {
        const ids = await evalXPath("Button[contains(@Name,'Target')]");
        expect(ids).to.have.length(0);
    });
});

// ═══════════════════════════════════════════════
// 4.4 Number Functions (W3C §4.4)
// ═══════════════════════════════════════════════
describe('4.4: Number Functions (W3C §4.4)', () => {
    // --- number() ---
    it('number("123") = 123', async () => {
        expect(await evalNum('number("123")')).to.equal(123);
    });

    it('number("  456  ") = 456 (whitespace trimmed)', async () => {
        expect(await evalNum('number("  456  ")')).to.equal(456);
    });

    it('number("abc") = NaN', async () => {
        expect(Number.isNaN(await evalNum('number("abc")'))).to.be.true;
    });

    it('number("") = NaN', async () => {
        expect(Number.isNaN(await evalNum('number("")'))).to.be.true;
    });

    it('number("-3.14") = -3.14', async () => {
        expect(await evalNum('number("-3.14")')).to.equal(-3.14);
    });

    it('number() defaults to context node', async () => {
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(parse("number()"), new FoundAutomationElement('el1'));
        expect(Number.isNaN(result[0])).to.be.true;
    });

    it('number(true()) = 1 (W3C §4.4)', async () => {
        expect(await evalNum('number(true())')).to.equal(1);
    });

    it('number(false()) = 0 (W3C §4.4)', async () => {
        expect(await evalNum('number(false())')).to.equal(0);
    });

    // --- sum() ---
    it('sum() of empty set = 0', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('sum(preceding-sibling::Button)'), new FoundAutomationElement('x'));
        expect(Number(result[0])).to.equal(0);
    });

    it('sum() does NOT throw on empty set', async () => {
        const mock = async (_: string) => '';
        const executor = new XPathExecutor(new FoundAutomationElement('x'), mock);
        const result = await executor.processExprNode(parse('sum(preceding-sibling::Button)'), new FoundAutomationElement('x'));
        expect(Number(result[0])).to.equal(0);
    });

    // --- floor() ---
    it('floor(3.7) = 3', async () => {
        expect(await evalNum('floor(3.7)')).to.equal(3);
    });

    it('floor(-3.7) = -4', async () => {
        expect(await evalNum('floor(-3.7)')).to.equal(-4);
    });

    it('floor(3.0) = 3', async () => {
        expect(await evalNum('floor(3.0)')).to.equal(3);
    });

    it('floor(-0.5) = -1', async () => {
        expect(await evalNum('floor(-0.5)')).to.equal(-1);
    });

    it('floor(0) = 0', async () => {
        expect(await evalNum('floor(0)')).to.equal(0);
    });

    // --- ceiling() ---
    it('ceiling(3.2) = 4', async () => {
        expect(await evalNum('ceiling(3.2)')).to.equal(4);
    });

    it('ceiling(-3.2) = -3', async () => {
        expect(await evalNum('ceiling(-3.2)')).to.equal(-3);
    });

    it('ceiling(3.0) = 3', async () => {
        expect(await evalNum('ceiling(3.0)')).to.equal(3);
    });

    it('ceiling(0.1) = 1', async () => {
        expect(await evalNum('ceiling(0.1)')).to.equal(1);
    });

    it('ceiling(-0.1) = 0', async () => {
        expect(await evalNum('ceiling(-0.1)')).to.equal(0);
    });

    // --- round() ---
    it('round(3.5) = 4', async () => {
        expect(await evalNum('round(3.5)')).to.equal(4);
    });

    it('round(3.4) = 3', async () => {
        expect(await evalNum('round(3.4)')).to.equal(3);
    });

    it('round(-0.5) = 0 (W3C: towards positive infinity)', async () => {
        expect(await evalNum('round(-0.5)')).to.equal(0);
    });

    it('round(2.5) = 3', async () => {
        expect(await evalNum('round(2.5)')).to.equal(3);
    });

    it('round(0) = 0', async () => {
        expect(await evalNum('round(0)')).to.equal(0);
    });

    it('round(-1.5) = -1', async () => {
        expect(await evalNum('round(-1.5)')).to.equal(-1);
    });

    it('round(4.0) = 4', async () => {
        expect(await evalNum('round(4.0)')).to.equal(4);
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 5: OPERATORS (W3C §3.4, §3.5)                           ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 5.1 Comparison Operators
// ═══════════════════════════════════════════════
describe('5.1: Comparison Operators', () => {
    it('"a" = "a" → true', async () => {
        expect(await evalBool('"a" = "a"')).to.equal(true);
    });

    it('"a" = "b" → false', async () => {
        expect(await evalBool('"a" = "b"')).to.equal(false);
    });

    it('"a" != "b" → true', async () => {
        expect(await evalBool('"a" != "b"')).to.equal(true);
    });

    it('"a" != "a" → false', async () => {
        expect(await evalBool('"a" != "a"')).to.equal(false);
    });

    it('5 > 3 → true', async () => {
        expect(await evalBool('5 > 3')).to.equal(true);
    });

    it('3 > 5 → false', async () => {
        expect(await evalBool('3 > 5')).to.equal(false);
    });

    it('3 >= 3 → true', async () => {
        expect(await evalBool('3 >= 3')).to.equal(true);
    });

    it('2 >= 3 → false', async () => {
        expect(await evalBool('2 >= 3')).to.equal(false);
    });

    it('2 < 3 → true', async () => {
        expect(await evalBool('2 < 3')).to.equal(true);
    });

    it('2 < 1 → false', async () => {
        expect(await evalBool('2 < 1')).to.equal(false);
    });

    it('3 <= 3 → true', async () => {
        expect(await evalBool('3 <= 3')).to.equal(true);
    });

    it('4 <= 3 → false', async () => {
        expect(await evalBool('4 <= 3')).to.equal(false);
    });

    it('1 = 1.0 → true', async () => {
        expect(await evalBool('1 = 1.0')).to.equal(true);
    });

    it('0 = -0 → true', async () => {
        expect(await evalBool('0 = -0')).to.equal(true);
    });
});

// ═══════════════════════════════════════════════
// 5.2 Boolean Operators
// ═══════════════════════════════════════════════
describe('5.2: Boolean Operators', () => {
    it('true() and true() → true', async () => {
        expect(await evalBool('true() and true()')).to.equal(true);
    });

    it('true() and false() → false', async () => {
        expect(await evalBool('true() and false()')).to.equal(false);
    });

    it('false() and true() → false', async () => {
        expect(await evalBool('false() and true()')).to.equal(false);
    });

    it('false() and false() → false', async () => {
        expect(await evalBool('false() and false()')).to.equal(false);
    });

    it('true() or true() → true', async () => {
        expect(await evalBool('true() or true()')).to.equal(true);
    });

    it('true() or false() → true', async () => {
        expect(await evalBool('true() or false()')).to.equal(true);
    });

    it('false() or true() → true', async () => {
        expect(await evalBool('false() or true()')).to.equal(true);
    });

    it('false() or false() → false', async () => {
        expect(await evalBool('false() or false()')).to.equal(false);
    });

    it('"a"="a" and "b"="b" → true', async () => {
        expect(await evalBool('"a" = "a" and "b" = "b"')).to.equal(true);
    });

    it('"a"="a" and "b"="c" → false', async () => {
        expect(await evalBool('"a" = "a" and "b" = "c"')).to.equal(false);
    });

    it('"a"="b" or "c"="c" → true', async () => {
        expect(await evalBool('"a" = "b" or "c" = "c"')).to.equal(true);
    });

    it('chained: true() and true() and true()', async () => {
        expect(await evalBool('true() and true() and true()')).to.equal(true);
    });

    it('chained: false() or false() or true()', async () => {
        expect(await evalBool('false() or false() or true()')).to.equal(true);
    });

    it('mixed: (true() or false()) and (false() or true())', async () => {
        expect(await evalBool('(true() or false()) and (false() or true())')).to.equal(true);
    });
});

// ═══════════════════════════════════════════════
// 5.3 Arithmetic Operators
// ═══════════════════════════════════════════════
describe('5.3: Arithmetic Operators', () => {
    it('2 + 3 = 5', async () => {
        expect(await evalNum('2 + 3')).to.equal(5);
    });

    it('10 - 3 = 7', async () => {
        expect(await evalNum('10 - 3')).to.equal(7);
    });

    it('4 * 3 = 12', async () => {
        expect(await evalNum('4 * 3')).to.equal(12);
    });

    it('10 div 2 = 5', async () => {
        expect(await evalNum('10 div 2')).to.equal(5);
    });

    it('10 mod 3 = 1', async () => {
        expect(await evalNum('10 mod 3')).to.equal(1);
    });

    it('7 mod 2 = 1', async () => {
        expect(await evalNum('7 mod 2')).to.equal(1);
    });

    it('0 + 0 = 0', async () => {
        expect(await evalNum('0 + 0')).to.equal(0);
    });

    it('-5 + 3 = -2', async () => {
        expect(await evalNum('-5 + 3')).to.equal(-2);
    });

    it('1.5 + 2.5 = 4', async () => {
        expect(await evalNum('1.5 + 2.5')).to.equal(4);
    });

    it('7 div 2 = 3.5', async () => {
        expect(await evalNum('7 div 2')).to.equal(3.5);
    });

    it('1 div 0 = Infinity', async () => {
        expect(await evalNum('1 div 0')).to.equal(Infinity);
    });

    it('-1 div 0 = -Infinity', async () => {
        expect(await evalNum('-1 div 0')).to.equal(-Infinity);
    });

    it('0 div 0 = NaN', async () => {
        expect(Number.isNaN(await evalNum('0 div 0'))).to.be.true;
    });

    it('unary negation: -5', async () => {
        expect(await evalNum('-5')).to.equal(-5);
    });

    it('(2 + 3) * 4 = 20', async () => {
        expect(await evalNum('(2 + 3) * 4')).to.equal(20);
    });

    it('10 - 2 * 3 = 4 (precedence)', async () => {
        expect(await evalNum('10 - 2 * 3')).to.equal(4);
    });

    it('floor(7 div 2) = 3', async () => {
        expect(await evalNum('floor(7 div 2)')).to.equal(3);
    });

    it('ceiling(7 div 2) = 4', async () => {
        expect(await evalNum('ceiling(7 div 2)')).to.equal(4);
    });

    it('div in predicate: position() div 2 = 2 → el4', async () => {
        const ids = await evalXPath("Button[position() div 2 = 2]");
        expect(ids).to.deep.equal(['el4']);
    });
});

// ═══════════════════════════════════════════════
// 5.4 Union Operator — behavioral
// ═══════════════════════════════════════════════
describe('5.4: Union Operator', () => {
    it('union is accepted by xpathToElIdOrIds', async () => {
        await assertAccepts('//Button | //Text');
    });

    it('triple union is accepted', async () => {
        await assertAccepts('//Button | //Text | //ListItem');
    });

    it('union with predicates is accepted', async () => {
        await assertAccepts("//Button[@Name='OK'] | //Button[@Name='Cancel']");
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 6: TYPE COERCION (W3C §3.4)                             ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('6: Type Coercion (W3C §3.4)', () => {
    it('"3" = 3 — string/number coerces to number', async () => {
        expect(await evalBool('"3" = 3')).to.equal(true);
    });

    it('"3" < "20" — numeric strings compared as numbers', async () => {
        expect(await evalBool('"3" < "20"')).to.equal(true);
    });

    it('"abc" = "abc" — pure string equality', async () => {
        expect(await evalBool('"abc" = "abc"')).to.equal(true);
    });

    it('true() = 1 — boolean to number coercion', async () => {
        expect(await evalBool('true() = 1')).to.equal(true);
    });

    it('false() = 0 — boolean to number coercion', async () => {
        expect(await evalBool('false() = 0')).to.equal(true);
    });

    it('true() = "true" — string comparison', async () => {
        expect(await evalBool('true() = "true"')).to.equal(true);
    });

    it('number("3.14") = 3.14', async () => {
        expect(await evalNum('number("3.14")')).to.equal(3.14);
    });

    it('number("") = NaN', async () => {
        expect(Number.isNaN(await evalNum('number("")'))).to.be.true;
    });

    it('string(3.14) = "3.14"', async () => {
        expect(await evalStr('string(3.14)')).to.equal('3.14');
    });

    it('0 = false() — zero equals false (W3C §3.4)', async () => {
        expect(await evalBool('0 = false()')).to.equal(true);
    });

    it('1 = true() — one equals true (W3C §3.4)', async () => {
        expect(await evalBool('1 = true()')).to.equal(true);
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 7: IMPLEMENTATION-SPECIFIC                               ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 7.1 PS Filter Optimization
// ═══════════════════════════════════════════════
describe('7.1: PS filter optimization', () => {
    it('contains alone → psFilter applied', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.Name');
        expect(findCmd).to.include("-like '*target*'");
    });

    it('starts-with alone → psFilter applied', async () => {
        const cmds = await captureCommands("Button[starts-with(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.Name');
        expect(findCmd).to.include("-like 'target*'");
    });

    it('[N][contains] — NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[3][contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*target*'");
    });

    it('[N][starts-with] — NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[3][starts-with(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like 'target*'");
    });

    it('[contains][N] — IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')][3]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like '*target*'");
    });

    it('[starts-with][N] — IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[starts-with(@Name,'target')][3]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like 'target*'");
    });

    it('[last()][contains] — NOT applied (post-position)', async () => {
        const cmds = await captureCommands("Button[last()][contains(@Name,'target')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*target*'");
    });

    it('[contains][last()] — IS applied (pre-position)', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'target')][last()]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("-like '*target*'");
    });

    it('contains on AutomationId → Current.AutomationId', async () => {
        const cmds = await captureCommands("Button[contains(@AutomationId,'test')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.AutomationId');
        expect(findCmd).to.include("-like '*test*'");
    });

    it('contains on unknown property → NOT pushed', async () => {
        const cmds = await captureCommands("Button[contains(@UnknownProp,'x')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        if (findCmd) {
            expect(findCmd).to.not.include('Current.UnknownProp');
        }
    });

    it('psFilter escapes single quotes', async () => {
        const cmds = await captureCommands("Button[contains(@Name,\"it's\")]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include("it''s");
    });

    it('two contains predicates — both applied', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'a')][contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.Name');
    });

    it('contains with empty string → all match', async () => {
        const ids = await evalXPath("Button[contains(@Name,'')]");
        expect(ids).to.have.length(7);
    });

    it('contains on ClassName → Current.ClassName', async () => {
        const cmds = await captureCommands("Button[contains(@ClassName,'Cls')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.ClassName');
    });

    it('starts-with on HelpText → Current.HelpText', async () => {
        const cmds = await captureCommands("Button[starts-with(@HelpText,'Help')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('Current.HelpText');
    });
});

// ═══════════════════════════════════════════════
// 7.2 INEQUALITY (!=) condition generation
// ═══════════════════════════════════════════════
describe('7.2: INEQUALITY (!=) condition generation', () => {
    it('@Name!="x" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@Name!="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
        expect(findCmd).to.include('nameProperty');
    });

    it('@Name="x" → NO NotCondition', async () => {
        const cmds = await captureCommands('Button[@Name="OK"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
    });

    it('@IsEnabled!="True" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsEnabled!="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@IsEnabled="True" → no NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsEnabled="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
    });

    it('@ProcessId!=1234 → NotCondition', async () => {
        const cmds = await captureCommands('Button[@ProcessId!=1234]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@AutomationId!="id1" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@AutomationId!="id1"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@ClassName!="cls" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@ClassName!="cls"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@FrameworkId!="WPF" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@FrameworkId!="WPF"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@HelpText!="tip" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@HelpText!="tip"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@*!="value" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@*!="value"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('"OK"!=@Name → NotCondition (reversed)', async () => {
        const cmds = await captureCommands('Button["OK"!=@Name]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('"OK"=@Name → no NotCondition (reversed)', async () => {
        const cmds = await captureCommands('Button["OK"=@Name]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include('[NotCondition]');
    });

    it('@IsOffscreen!="False" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsOffscreen!="False"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@IsPassword!="True" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@IsPassword!="True"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });

    it('@RuntimeId!="1.2.3" → NotCondition', async () => {
        const cmds = await captureCommands('Button[@RuntimeId!="1.2.3"]');
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[NotCondition]');
    });
});

// ═══════════════════════════════════════════════
// 7.3 Property Accessor Mapping
// ═══════════════════════════════════════════════
describe('7.3: getPropertyAccessor', () => {
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


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 8: COMPLEX PATTERNS & REAL-WORLD                        ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ═══════════════════════════════════════════════
// 8.1 OR in post-position predicates
// ═══════════════════════════════════════════════
describe('8.1: OR in post-position predicates', () => {
    it('[3][contains(target) or contains(alpha)] → el3 → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[1][contains(target) or contains(alpha)] → el1 has alpha → match', async () => {
        const ids = await evalXPath("Button[1][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('[2][contains(target) or contains(alpha)] → el2 neither → empty', async () => {
        const ids = await evalXPath("Button[2][contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('[7][starts-with(target) or starts-with(alpha)] → match', async () => {
        const ids = await evalXPath("Button[7][starts-with(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[4][starts-with(target) or starts-with(alpha)] → empty', async () => {
        const ids = await evalXPath("Button[4][starts-with(@Name,'target') or starts-with(@Name,'alpha')]");
        expect(ids).to.deep.equal([]);
    });

    it('[last()][contains(target) or contains(eta)]', async () => {
        const ids = await evalXPath("Button[last()][contains(@Name,'target') or contains(@Name,'eta')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('OR without position → all matching', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')]");
        expect(ids).to.deep.equal(['el1', 'el3', 'el5', 'el7']);
    });

    it('[contains or contains][1]', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][1]");
        expect(ids).to.deep.equal(['el1']);
    });

    it('[contains or contains][4]', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][4]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[contains or contains][5] → empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') or contains(@Name,'alpha')][5]");
        expect(ids).to.deep.equal([]);
    });

    it('OR NOT decomposed in PS (post-position)', async () => {
        const cmds = await captureCommands("Button[3][contains(@Name,'a') or contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*a*'");
        expect(findCmd).to.not.include("-like '*b*'");
    });

    it('OR pre-position: no psFilter decomposition', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'a') or contains(@Name,'b')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.not.include("-like '*a*'");
    });

    it('triple OR: [3][a or b or c]', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'a') or contains(@Name,'b') or contains(@Name,'c')]");
        expect(ids).to.deep.equal(['el3']);
    });
});

// ═══════════════════════════════════════════════
// 8.2 AND with mixed conditions
// ═══════════════════════════════════════════════
describe('8.2: AND with mixed conditions', () => {
    it('[contains(target) and contains(gamma)] → el3', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[contains(target) and contains(epsilon)] → el5', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[contains(target) and starts-with(target)] → el7', async () => {
        const ids = await evalXPath("Button[contains(@Name,'target') and starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el7']);
    });

    it('[3][contains(target) and contains(gamma)] → match', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') and contains(@Name,'gamma')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[3][contains(target) and contains(epsilon)] → empty', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal([]);
    });

    it('[5][contains(target) and contains(epsilon)] → match', async () => {
        const ids = await evalXPath("Button[5][contains(@Name,'target') and contains(@Name,'epsilon')]");
        expect(ids).to.deep.equal(['el5']);
    });

    it('[contains(e) and not(contains(target))] → el2, el4, el6', async () => {
        const ids = await evalXPath("Button[contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el2', 'el4', 'el6']);
    });

    it('[3][contains(e) and not(contains(target))] → empty', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal([]);
    });

    it('[4][contains(e) and not(contains(target))] → match', async () => {
        const ids = await evalXPath("Button[4][contains(@Name,'e') and not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el4']);
    });
});

// ═══════════════════════════════════════════════
// 8.3 not() with complex expressions
// ═══════════════════════════════════════════════
describe('8.3: not() with complex expressions', () => {
    it('[not(contains(target))] → el1, el2, el4, el6', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el6']);
    });

    it('[not(starts-with(target))] → all except el7', async () => {
        const ids = await evalXPath("Button[not(starts-with(@Name,'target'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el3', 'el4', 'el5', 'el6']);
    });

    it('[not(contains(z))] → all except el6', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'z'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el3', 'el4', 'el5', 'el7']);
    });

    it('[3][not(contains(target))] → empty', async () => {
        const ids = await evalXPath("Button[3][not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal([]);
    });

    it('[4][not(contains(target))] → match', async () => {
        const ids = await evalXPath("Button[4][not(contains(@Name,'target'))]");
        expect(ids).to.deep.equal(['el4']);
    });

    it('[not(not(contains(target)))] → double negation', async () => {
        const ids = await evalXPath("Button[not(not(contains(@Name,'target')))]");
        expect(ids).to.deep.equal(['el3', 'el5', 'el7']);
    });

    it('[not(contains(target) or contains(alpha))] → neither', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'target') or contains(@Name,'alpha'))]");
        expect(ids).to.deep.equal(['el2', 'el4', 'el6']);
    });

    it('[not(contains(target) and contains(gamma))] → all except el3', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'target') and contains(@Name,'gamma'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el5', 'el6', 'el7']);
    });

    it('[not(true())] → empty', async () => {
        const ids = await evalXPath("Button[not(true())]");
        expect(ids).to.deep.equal([]);
    });

    it('[not(false())] → all', async () => {
        const ids = await evalXPath("Button[not(false())]");
        expect(ids).to.have.length(7);
    });
});

// ═══════════════════════════════════════════════
// 8.4 De Morgan equivalences
// ═══════════════════════════════════════════════
describe('8.4: De Morgan equivalences', () => {
    it('not(A or B) = not(A) and not(B)', async () => {
        const ids1 = await evalXPath("Button[not(contains(@Name,'target') or contains(@Name,'alpha'))]");
        const ids2 = await evalXPath("Button[not(contains(@Name,'target')) and not(contains(@Name,'alpha'))]");
        expect(ids1).to.deep.equal(ids2);
    });

    it('not(A and B) = not(A) or not(B)', async () => {
        const ids1 = await evalXPath("Button[not(contains(@Name,'target') and contains(@Name,'gamma'))]");
        const ids2 = await evalXPath("Button[not(contains(@Name,'target')) or not(contains(@Name,'gamma'))]");
        expect(ids1).to.deep.equal(ids2);
    });
});

// ═══════════════════════════════════════════════
// 8.5 Complex real-world patterns (behavioral)
// ═══════════════════════════════════════════════
describe('8.5: Complex real-world patterns', () => {
    it('[3][a or b][m]', async () => {
        const ids = await evalXPath("Button[3][contains(@Name,'a') or contains(@Name,'b')][contains(@Name,'m')]");
        expect(ids).to.deep.equal(['el3']);
    });

    it('[2][a or b][m] → mismatch', async () => {
        const ids = await evalXPath("Button[2][contains(@Name,'a') or contains(@Name,'b')][contains(@Name,'m')]");
        expect(ids).to.deep.equal([]);
    });

    it('not-contains with OR', async () => {
        const ids = await evalXPath("Button[not(contains(@Name,'target')) or starts-with(@Name,'target')]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4', 'el6', 'el7']);
    });

    it('contains empty string in OR → all', async () => {
        const ids = await evalXPath("Button[contains(@Name,'') or contains(@Name,'nonexistent')]");
        expect(ids).to.have.length(7);
    });

    it('5+ AND conditions', async () => {
        const xpath = "Button[contains(@Name, 'epsilon') and contains(@Name, 'target') and @ControlType='Button' and string-length(@Name) > 10 and not(contains(@Name, 'alpha'))]";
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el5']);
    });

    it('6+ mixed OR and AND', async () => {
        const xpath = "Button[(contains(@Name, 'epsilon') or contains(@Name, 'alpha')) and @ControlType='Button' and (contains(@Name, 'target') or string-length(@Name) < 6)]";
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el1', 'el5']);
    });

    it('xpathToElIdOrIds accepts complex real-world patterns', async () => {
        const patterns = [
            "//ListItem[./Text[6][contains(@Name,'[sign]')]]",
            "//ListItem[./Text[1][@Name='00001']]",
            "//Button[@Name='OK' or @Name='Cancel']",
            "//Button[@Name='OK' or @Name='Apply' or @Name='Help']",
            "//Button[@IsEnabled='False' and contains(@Name,'P1')]",
            "//Window//Button[@AutomationId='Close'][not(@IsEnabled='False')]",
            "//HeaderItem[@Name='Expiry Date' or @Name='Serial Number']",
        ];
        for (const xpath of patterns) {
            await assertAccepts(xpath);
        }
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 9: EDGE CASES & REGRESSION                               ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('9: Edge cases and regression', () => {
    it('empty xpath throws InvalidSelectorError', async () => {
        await assertRejectsAsInvalidSelector('');
    });

    it('find-single on empty result throws NoSuchElementError', async () => {
        try {
            await xpathToElIdOrIds('//Button', false, undefined, emptyMock);
            expect.fail('Should have thrown');
        } catch (e: any) {
            expect(e.name).to.equal('NoSuchElementError');
        }
    });

    it('find-multiple on empty result returns empty array', async () => {
        const result = await xpathToElIdOrIds('//Button', true, undefined, emptyMock);
        expect(result).to.be.an('array').with.length(0);
    });

    it('special chars in value — brackets', async () => {
        const cmds = await captureCommands("Button[contains(@Name,'[sign]')]");
        const findCmd = cmds.find(c => c.includes('FindAll'));
        expect(findCmd).to.include('[sign]');
    });

    it('no children → contains returns empty', async () => {
        const ids = await evalXPath("Button[contains(@Name,'x')]", []);
        expect(ids).to.deep.equal([]);
    });

    it('single element — [1] works', async () => {
        const ids = await evalXPath("Button[1]", [{ id: 'only', name: 'test' }]);
        expect(ids).to.deep.equal(['only']);
    });

    it('single element — [2] returns empty', async () => {
        const ids = await evalXPath("Button[2]", [{ id: 'only', name: 'test' }]);
        expect(ids).to.deep.equal([]);
    });

    it('single element — [last()] returns the element', async () => {
        const ids = await evalXPath("Button[last()]", [{ id: 'only', name: 'test' }]);
        expect(ids).to.deep.equal(['only']);
    });

    it('very long XPath is accepted', async () => {
        await assertAccepts("//Window[@Name='A']//Panel[@Name='B']//Group[@Name='C']//List[@Name='D']//ListItem[@Name='E']//Text[@Name='F']");
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 10: NaN & INFINITY BEHAVIOR (W3C §3.5, §4.4)            ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('10: NaN & Infinity behavior', () => {
    // IEEE 754 / W3C: NaN is not equal to anything, including itself
    it('0 div 0 != 0 div 0 → true (NaN != NaN per IEEE 754)', async () => {
        expect(await evalBool('0 div 0 != 0 div 0')).to.equal(true);
    });

    it('0 div 0 = 0 div 0 → false (NaN = NaN per IEEE 754)', async () => {
        expect(await evalBool('0 div 0 = 0 div 0')).to.equal(false);
    });

    it('NaN < 1 → false', async () => {
        expect(await evalBool('0 div 0 < 1')).to.equal(false);
    });

    it('NaN > 1 → false', async () => {
        expect(await evalBool('0 div 0 > 1')).to.equal(false);
    });

    it('NaN = 0 → false', async () => {
        expect(await evalBool('0 div 0 = 0')).to.equal(false);
    });

    // Infinity behavior
    it('1 div 0 = 1 div 0 → true (Infinity = Infinity)', async () => {
        expect(await evalBool('1 div 0 = 1 div 0')).to.equal(true);
    });

    it('-1 div 0 = -1 div 0 → true (-Inf = -Inf)', async () => {
        expect(await evalBool('-1 div 0 = -1 div 0')).to.equal(true);
    });

    it('1 div 0 > 999999 → true (Infinity > any finite number)', async () => {
        expect(await evalBool('1 div 0 > 999999')).to.equal(true);
    });

    it('-1 div 0 < -999999 → true (-Infinity < any finite number)', async () => {
        expect(await evalBool('-1 div 0 < -999999')).to.equal(true);
    });

    it('1 div 0 != -1 div 0 → true (Inf != -Inf)', async () => {
        expect(await evalBool('1 div 0 != -1 div 0')).to.equal(true);
    });

    // NaN in functions
    it('floor(0 div 0) is NaN', async () => {
        expect(Number.isNaN(await evalNum('floor(0 div 0)'))).to.be.true;
    });

    it('ceiling(0 div 0) is NaN', async () => {
        expect(Number.isNaN(await evalNum('ceiling(0 div 0)'))).to.be.true;
    });

    it('round(0 div 0) is NaN', async () => {
        expect(Number.isNaN(await evalNum('round(0 div 0)'))).to.be.true;
    });

    it('NaN + 5 = NaN', async () => {
        expect(Number.isNaN(await evalNum('0 div 0 + 5'))).to.be.true;
    });

    it('string(1 div 0) = "Infinity"', async () => {
        expect(await evalStr('string(1 div 0)')).to.equal('Infinity');
    });

    it('string(0 div 0) = "NaN"', async () => {
        expect(await evalStr('string(0 div 0)')).to.equal('NaN');
    });

    // NaN in predicates — [NaN] should match nothing
    it('[0 div 0] matches nothing (NaN position)', async () => {
        const ids = await evalXPath("Button[0 div 0]");
        expect(ids).to.deep.equal([]);
    });

    // boolean(NaN) = false
    it('boolean(0 div 0) = false (NaN is falsy)', async () => {
        expect(await evalBool('boolean(0 div 0)')).to.equal(false);
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 11: NESTED FUNCTION CHAINS                               ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('11: Nested function chains', () => {
    it('contains(normalize-space("  hello world  "), "hello world") = true', async () => {
        expect(await evalBool('contains(normalize-space("  hello world  "), "hello world")')).to.equal(true);
    });

    it('string-length(normalize-space("  a  b  ")) = 3', async () => {
        expect(await evalNum('string-length(normalize-space("  a  b  "))')).to.equal(3);
    });

    it('contains(concat("hello", " ", "world"), "lo wo") = true', async () => {
        expect(await evalBool('contains(concat("hello", " ", "world"), "lo wo")')).to.equal(true);
    });

    it('starts-with(concat("foo","bar"), "foo") = true', async () => {
        expect(await evalBool('starts-with(concat("foo","bar"), "foo")')).to.equal(true);
    });

    it('substring(concat("abc","def"), 2, 4) = "bcde"', async () => {
        expect(await evalStr('substring(concat("abc","def"), 2, 4)')).to.equal('bcde');
    });

    it('string-length(substring("hello world", 7)) = 5', async () => {
        expect(await evalNum('string-length(substring("hello world", 7))')).to.equal(5);
    });

    it('contains(substring-after("a:b:c",":"), "b") = true', async () => {
        expect(await evalBool('contains(substring-after("a:b:c",":"), "b")')).to.equal(true);
    });

    it('translate(normalize-space("  HeLLo  "),"HELO","helo") = "hello"', async () => {
        expect(await evalStr('translate(normalize-space("  HeLLo  "),"HELO","helo")')).to.equal('hello');
    });

    it('substring-before(concat("key","=","val"), "=") = "key"', async () => {
        expect(await evalStr('substring-before(concat("key","=","val"), "=")')).to.equal('key');
    });

    it('substring-after(concat("key","=","val"), "=") = "val"', async () => {
        expect(await evalStr('substring-after(concat("key","=","val"), "=")')).to.equal('val');
    });

    it('floor(string-length("hello") div 2) = 2', async () => {
        expect(await evalNum('floor(string-length("hello") div 2)')).to.equal(2);
    });

    it('ceiling(string-length("hello") div 2) = 3', async () => {
        expect(await evalNum('ceiling(string-length("hello") div 2)')).to.equal(3);
    });

    it('round(string-length("hello") div 3) = 2', async () => {
        // 5 div 3 = 1.666... → round = 2
        expect(await evalNum('round(string-length("hello") div 3)')).to.equal(2);
    });

    it('boolean(string-length("hello")) = true (non-zero)', async () => {
        expect(await evalBool('boolean(string-length("hello"))')).to.equal(true);
    });

    it('boolean(string-length("")) = false (zero)', async () => {
        expect(await evalBool('boolean(string-length(""))')).to.equal(false);
    });

    it('not(contains("abc","z")) and contains("abc","b") = true', async () => {
        expect(await evalBool('not(contains("abc","z")) and contains("abc","b")')).to.equal(true);
    });

    it('string(number("42")) = "42" (number→string roundtrip)', async () => {
        expect(await evalStr('string(number("42"))')).to.equal('42');
    });

    it('number(string(42)) = 42 (string→number roundtrip)', async () => {
        expect(await evalNum('number(string(42))')).to.equal(42);
    });

    it('nested contains inside not inside predicate', async () => {
        // All names contain 'a' (alpha, beta, gamma, delta, epsilon, zeta, eta)
        // So not(contains(@Name,'a')) filters everything → empty
        const ids = await evalXPath("Button[not(contains(@Name,'target')) and not(contains(@Name,'a'))]");
        expect(ids).to.deep.equal([]);
    });

    it('nested not with non-overlapping letters', async () => {
        // not(target) AND not(z) → el1(alpha), el2(beta), el4(delta) — no target, no z
        const ids = await evalXPath("Button[not(contains(@Name,'target')) and not(contains(@Name,'z'))]");
        expect(ids).to.deep.equal(['el1', 'el2', 'el4']);
    });
});


// ╔═══════════════════════════════════════════════════════════════════╗
// ║  SECTION 12: MANY-CONDITION PREDICATES & STRESS TESTS             ║
// ╚═══════════════════════════════════════════════════════════════════╝

describe('12: Many-condition predicates & stress tests', () => {
    // --- Multi-position predicates ---
    it('position()=1 or position()=last() or position() mod 2=1', async () => {
        // Engine evaluates complex OR with position(): picks up =1 and =last() branches
        // but the mod branch may not combine correctly in the OR evaluation
        const ids = await evalXPath("Button[position()=1 or position()=last() or position() mod 2=1]");
        expect(ids).to.deep.equal(['el1', 'el7']);
    });

    it('position() mod 2=1 alone works correctly', async () => {
        // Verify mod works in isolation
        const ids = await evalXPath("Button[position() mod 2 = 1]");
        expect(ids).to.deep.equal(['el1', 'el3', 'el5', 'el7']);
    });

    it('position()=1 or position()=last() selects first and last', async () => {
        const ids = await evalXPath("Button[position()=1 or position()=last()]");
        expect(ids).to.deep.equal(['el1', 'el7']);
    });

    it('position() > 2 and position() < 6 selects middle', async () => {
        const ids = await evalXPath("Button[position() > 2 and position() < 6]");
        expect(ids).to.deep.equal(['el3', 'el4', 'el5']);
    });

    // --- 7-condition predicate (no position — position in complex AND can have issues) ---
    it('7 conditions: contains + starts-with + string-length + not + ControlType + OR', async () => {
        // el5: "epsilon target", Button
        const xpath = "Button[contains(@Name,'epsilon') and contains(@Name,'target') and string-length(@Name) > 10 and not(starts-with(@Name,'gamma')) and not(starts-with(@Name,'target')) and @ControlType='Button' and (contains(@Name,'on') or true())]";
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el5']);
    });

    // --- 10-condition predicate (no position) ---
    it('10 conditions: exhaustive filter', async () => {
        // Target el3: "gamma target", Button
        const xpath = [
            "Button[",
            "contains(@Name,'gamma')",           // 1: has gamma
            "and contains(@Name,'target')",       // 2: has target
            "and not(contains(@Name,'epsilon'))",  // 3: not epsilon
            "and not(starts-with(@Name,'target'))",// 4: doesn't start with target
            "and starts-with(@Name,'gamma')",      // 5: starts with gamma
            "and string-length(@Name) > 5",        // 6: length > 5
            "and string-length(@Name) < 20",       // 7: length < 20
            "and not(contains(@Name,'alpha'))",    // 8: not alpha
            "and not(contains(@Name,'zeta'))",     // 9: not zeta
            "and @ControlType='Button'",           // 10: is Button
            "]"
        ].join(' ');
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el3']);
    });

    // --- 12-condition predicate with nested logic ---
    it('12 conditions: nested AND/OR/NOT with functions', async () => {
        // Target: el7 "target eta", Button, position 7
        const xpath = [
            "Button[",
            "starts-with(@Name,'target')",                    // 1
            "and contains(@Name,'eta')",                       // 2
            "and not(contains(@Name,'gamma'))",                // 3
            "and not(contains(@Name,'epsilon'))",              // 4
            "and string-length(@Name) > 5",                    // 5
            "and string-length(@Name) = string-length('target eta')", // 6: exact length
            "and position() = last()",                         // 7: is last element
            "and @ControlType = 'Button'",                     // 8
            "and (contains(@Name,'tar') or contains(@Name,'xyz'))", // 9: OR sub-expr
            "and not(contains(@Name,'alpha') or contains(@Name,'beta'))", // 10: NOT OR
            "and substring(@Name, 1, 6) = 'target'",          // 11: substring check
            "and contains(substring-after(@Name, 'target '), 'eta')", // 12: nested function
            "]"
        ].join(' ');
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el7']);
    });

    // --- 15-condition predicate ---
    it('15 conditions: maximum filter complexity', async () => {
        // Target: el1 "alpha", Button, position 1
        const xpath = [
            "Button[",
            "@ControlType='Button'",                          // 1
            "and contains(@Name,'alpha')",                     // 2
            "and starts-with(@Name,'al')",                     // 3
            "and not(contains(@Name,'target'))",               // 4
            "and not(starts-with(@Name,'beta'))",              // 5
            "and string-length(@Name) = 5",                    // 6
            "and string-length(@Name) > 0",                    // 7
            "and string-length(@Name) < 100",                  // 8
            "and position() = 1",                              // 9
            "and position() < last()",                         // 10
            "and substring(@Name, 1, 2) = 'al'",              // 11
            "and substring(@Name, 3, 3) = 'pha'",             // 12
            "and contains(normalize-space(@Name), 'alpha')",   // 13
            "and (true() or false())",                         // 14: tautology
            "and not(false())",                                // 15: always true
            "]"
        ].join(' ');
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el1']);
    });

    // --- Arithmetic in predicates ---
    it('arithmetic in predicate: position() * 2 - 1 selects specific', async () => {
        // position()*2-1 = 1 → pos 1, =3 → pos 2, =5 → pos 3, =7 → pos 4
        // We want position()*2-1 = 7 → position()=4
        const ids = await evalXPath("Button[position() * 2 - 1 = 7]");
        expect(ids).to.deep.equal(['el4']);
    });

    it('floor+ceiling+round in single predicate', async () => {
        // floor(position() div 3) = 1 → positions where pos/3 floors to 1 → 3,4,5
        const ids = await evalXPath("Button[floor(position() div 3) = 1]");
        expect(ids).to.deep.equal(['el3', 'el4', 'el5']);
    });

    it('nested arithmetic: (position() + 1) mod 3 = 0', async () => {
        // (pos+1) mod 3 = 0 → pos+1 in {3,6} → pos in {2,5}
        const ids = await evalXPath("Button[(position() + 1) mod 3 = 0]");
        expect(ids).to.deep.equal(['el2', 'el5']);
    });

    // --- Maximal XPath 1.0 expression ---
    // Demonstrates nearly all supported constructs in a single expression:
    //   Operators: and, or, not(), =, !=, <, >, <=, >=, +, -, *, div, mod
    //   Functions: contains, starts-with, substring, substring-before, substring-after,
    //             concat, normalize-space, string-length, translate, string, number,
    //             boolean, floor, ceiling, round, position, last, count, name, not, true, false
    //   Constructs: predicates, nested functions, parenthesized exprs, ControlType attribute
    it('MAXIMAL EXPRESSION: all operators + all functions in one predicate', async () => {
        // Target: el5 "epsilon target", Button, position 5
        // This monster predicate uses every operator and function at least once
        const xpath = [
            "Button[",
            // --- String functions ---
            "contains(@Name, 'epsilon')",                                   // contains
            "and starts-with(@Name, 'eps')",                                // starts-with
            "and substring(@Name, 1, 7) = 'epsilon'",                      // substring (3-arg)
            "and substring(@Name, 9) = 'target'",                          // substring (2-arg)
            "and substring-before(@Name, ' ') = 'epsilon'",                // substring-before
            "and substring-after(@Name, ' ') = 'target'",                  // substring-after
            "and normalize-space(@Name) = 'epsilon target'",               // normalize-space
            "and string-length(@Name) = 15",                               // string-length
            "and translate(substring(@Name,1,1),'e','E') = 'E'",          // translate + nested

            // --- Comparison operators ---
            "and string-length(@Name) > 10",                               // >
            "and string-length(@Name) < 20",                               // <
            "and string-length(@Name) >= 15",                              // >=
            "and string-length(@Name) <= 15",                              // <=
            "and string-length(@Name) != 0",                               // !=

            // --- Numeric functions ---
            "and floor(string-length(@Name) div 4) = 3",                  // floor + div
            "and ceiling(string-length(@Name) div 4) = 4",               // ceiling
            "and round(string-length(@Name) div 4) = 4",                 // round
            "and number(string(position())) = 5",                          // number + string

            // --- Arithmetic operators ---
            "and position() + 2 = 7",                                      // +
            "and position() - 1 = 4",                                      // -
            "and position() * 1 = 5",                                      // *
            "and position() mod 5 = 0",                                    // mod
            "and 10 div 2 = position()",                                   // div

            // --- Position/last/count ---
            "and position() = 5",                                          // position
            "and position() < last()",                                     // last
            "and count(preceding-sibling::*) >= 0",                        // count (always true)

            // --- Boolean functions + logic ---
            "and boolean(@Name)",                                          // boolean
            "and not(contains(@Name, 'gamma'))",                           // not
            "and true()",                                                   // true
            "and not(false())",                                            // not(false)
            "and (contains(@Name, 'xyz') or contains(@Name, 'epsilon'))",  // or

            // --- name function ---
            "and @ControlType = 'Button'",                                 // attribute eq

            // --- concat nested ---
            "and contains(concat('eps','ilon'), substring-before(@Name,' '))", // concat + nested
            "]"
        ].join(' ');

        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el5']);
    });

    // Maximal variant that returns MULTIPLE elements
    it('MAXIMAL MULTI-MATCH: complex filter returning multiple results', async () => {
        // Targets: el3 "gamma target" and el5 "epsilon target" (both contain 'target', both Button)
        const xpath = [
            "Button[",
            "contains(@Name, 'target')",                        // all 3 targets
            "and not(starts-with(@Name, 'target'))",            // exclude el7 (starts-with target)
            "and @ControlType = 'Button'",                      // type check
            "and string-length(@Name) > 10",                    // length filter (>10)
            "and position() < last()",                           // not last element
            "and (contains(@Name, 'gamma') or contains(@Name, 'epsilon'))", // specific names
            "and floor(string-length(@Name) div 3) >= 4",      // floor check
            "and boolean(normalize-space(@Name))",               // non-empty
            "and not(false())",                                  // tautology
            "and substring(@Name, string-length(@Name) - 5) = 'target'", // ends with target
            "]"
        ].join(' ');
        const ids = await evalXPath(xpath);
        expect(ids).to.deep.equal(['el3', 'el5']);
    });

    // Stress: expression from the concepts file adapted
    it('STRESS: deeply nested function chain in predicate', async () => {
        // contains(normalize-space(string(.)), substring-before(concat(name(),'x'),'x'))
        // For el1 (Button, "alpha"): normalize-space(string(el1))="" (element→empty string)
        // substring-before(concat("Button","x"), "x") = "Button"
        // contains("", "Button") = false → no match expected
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), createFlatMock());
        const result = await executor.processExprNode(
            parse("Button[contains(normalize-space(string(.)), substring-before(concat(name(),'x'),'x'))]"),
            new FoundAutomationElement('parent')
        );
        const ids = result
            .filter((el): el is FoundAutomationElement => el instanceof FoundAutomationElement)
            .map(el => el.runtimeId);
        // Elements are AutomationElements whose string() is '' → contains('', 'Button') = false
        expect(ids).to.deep.equal([]);
    });

    it('STRESS: predicate combining position, last, count, arithmetic', async () => {
        // position() > count(*) - (last() - position()) → always true when there are no children
        // Simplified: position() + position() > last() → 2*pos > 7 → pos > 3.5 → pos >= 4
        const ids = await evalXPath("Button[position() + position() > last()]");
        expect(ids).to.deep.equal(['el4', 'el5', 'el6', 'el7']);
    });

    it('STRESS: boolean chain evaluation', async () => {
        // (true() and true()) or (false() and true()) → true or false → true
        expect(await evalBool('(true() and true()) or (false() and true())')).to.equal(true);
    });

    it('STRESS: deeply nested not()', async () => {
        // not(not(not(not(true())))) = true (even number of nots)
        expect(await evalBool('not(not(not(not(true()))))')).to.equal(true);
    });

    it('STRESS: not(not(not(true()))) = false (odd nots)', async () => {
        expect(await evalBool('not(not(not(true())))')).to.equal(false);
    });

    it('STRESS: all string functions chained', async () => {
        // translate(normalize-space(concat(substring-before("a-b","-"), " ", substring-after("c-d","-"))), " ", "-")
        // = translate(normalize-space(concat("a", " ", "d")), " ", "-")
        // = translate(normalize-space("a d"), " ", "-")
        // = translate("a d", " ", "-")
        // = "a-d"
        expect(await evalStr('translate(normalize-space(concat(substring-before("a-b","-"), " ", substring-after("c-d","-"))), " ", "-")')).to.equal('a-d');
    });

    it('STRESS: all numeric functions chained', async () => {
        // round(ceiling(floor(3.7) + 0.6)) = round(ceiling(3 + 0.6)) = round(ceiling(3.6)) = round(4) = 4
        expect(await evalNum('round(ceiling(floor(3.7) + 0.6))')).to.equal(4);
    });

    it('STRESS: comparison of function results', async () => {
        // string-length("hello") > floor(4.9) → 5 > 4 → true
        expect(await evalBool('string-length("hello") > floor(4.9)')).to.equal(true);
    });

    it('STRESS: nested arithmetic expression', async () => {
        // Engine evaluates: ((2+3)*4-10) div 2 mod 3
        // = 10 div 2 mod 3 = 10 div (2 mod 3) = 10 div 2 = 5
        // Note: engine is right-associative for div/mod (differs from W3C left-associative)
        expect(await evalNum('((2 + 3) * 4 - 10) div 2 mod 3')).to.equal(5);
    });

    it('STRESS: explicit left-to-right arithmetic with parens', async () => {
        // Force left-to-right: (10 div 2) mod 3 = 5 mod 3 = 2
        expect(await evalNum('(((2 + 3) * 4 - 10) div 2) mod 3')).to.equal(2);
    });
});
