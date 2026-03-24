
import { expect } from 'chai';
import { xpathToElIdOrIds } from '../../lib/xpath';
import { XPathExecutor } from '../../lib/xpath/core';
import { FoundAutomationElement } from '../../lib/powershell';
import { decodePwsh } from '../../lib/powershell/core';
import XPathAnalyzer from 'xpath-analyzer';
import assert from 'assert';

// Mock sendPowerShellCommand
const mockSendPowerShellCommand = async (command: string): Promise<string> => {
    return ""; // Return empty for now, we just want to test parsing logic if possible
    // OR we test the internal helpers if exposed.
    // Since xpathToElIdOrIds is the public API and relies on PS execution,
    // we might just test that it throws on invalid XPath for now
    // or checks that parsing doesn't crash.
};

describe('XPath Parsing', () => {
    it('should throw InvalidSelectorError on malformed XPath', async () => {
        try {
            await xpathToElIdOrIds("///invalid[", false, undefined, mockSendPowerShellCommand);
            assert.fail("Should have thrown error");
        } catch (e: any) {
            expect(e.name).to.equal('InvalidSelectorError');
        }
    });

    // To test optimization logic (optimizeDoubleSlash), we would need to export it
    // or inspect the side effects. For this level of unit test, ensuring it builds
    // and basic validation is a good start.
});

describe('XPath predicate ordering — position then function', () => {
    // 5 child elements: only el3 has Name containing 'target'.
    // The mock simulates real PS behavior:
    //   - If psFilter is embedded in the findAll command (Where-Object Current.Name), return only matching elements.
    //   - Without psFilter, return all 5 elements.
    // This lets us verify whether the fix correctly delays contains evaluation until after position filtering.
    const makePredicateOrderMock = () => async (command: string): Promise<string> => {
        const decoded = decodePwsh(command);

        // Bulk lookup intercept
        if (decoded.includes('|#|')) {
            if (decoded.includes("'el3'") && decoded.includes('NameProperty')) {
                return 'el3|#|target value';
            }
            return '';
        }

        // findAll with psFilter embedded — simulates PS actually filtering
        if (decoded.includes('FindAll') && decoded.includes('Current.Name') && decoded.includes('target')) {
            return 'el3'; // only the element whose Name matches
        }

        // findAll without psFilter — return all children
        if (decoded.includes('FindAll')) {
            return 'el1\nel2\nel3\nel4\nel5';
        }

        // GetPropertyValue(RuntimeId) for el3 — called when evaluating @Name on el3
        if (decoded.includes("'el3'") && decoded.includes('RuntimeIdProperty')) {
            return 'el3';
        }

        // GetPropertyValue(Name) for el3 — PS uses the exact property name from XPath @Name → 'NameProperty'
        if (decoded.includes("'el3'") && decoded.includes('NameProperty')) {
            return 'target value';
        }

        return '';
    };

    it('[pos][contains] picks position from full set, then tests contains — returns 1 result', async () => {
        // `Button[3][contains(@Name,'target')]`:
        // Correct XPath semantics: pick element at position 3, then test if its Name contains 'target'.
        // el3 is at position 3 and its Name is 'target value' → should match.
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), makePredicateOrderMock());
        const parsed = new XPathAnalyzer("Button[3][contains(@Name,'target')]").parse();
        const result = await executor.processExprNode(parsed, new FoundAutomationElement('parent'));
        const foundEls = result.filter((el) => el instanceof FoundAutomationElement);
        expect(foundEls).to.have.length(1);
        expect((foundEls[0] as FoundAutomationElement).runtimeId).to.equal('el3');
    });

    it('[contains][pos] filters by contains first, then picks position — returns 1 result', async () => {
        // `Button[contains(@Name,'target')][3]`:
        // First filter by contains → only el3 matches → 1 element.
        // Then pick position 3 → el3 is only at position 1 in filtered list → returns nothing.
        // (This test verifies the REVERSE order: contains-first, then position.)
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), makePredicateOrderMock());
        const parsed = new XPathAnalyzer("Button[contains(@Name,'target')][3]").parse();
        const result = await executor.processExprNode(parsed, new FoundAutomationElement('parent'));
        const foundEls = result.filter((el) => el instanceof FoundAutomationElement);
        // Only el3 matches contains. The contains-filtered list has 1 element. Position 3 → nothing.
        expect(foundEls).to.have.length(0);
    });

    it('[contains][1] filters by contains, picks position 1 from filtered set', async () => {
        // `Button[contains(@Name,'target')][1]`: filter by contains → el3 is position 1 → matches.
        const executor = new XPathExecutor(new FoundAutomationElement('parent'), makePredicateOrderMock());
        const parsed = new XPathAnalyzer("Button[contains(@Name,'target')][1]").parse();
        const result = await executor.processExprNode(parsed, new FoundAutomationElement('parent'));
        const foundEls = result.filter((el) => el instanceof FoundAutomationElement);
        expect(foundEls).to.have.length(1);
        expect((foundEls[0] as FoundAutomationElement).runtimeId).to.equal('el3');
    });
});
