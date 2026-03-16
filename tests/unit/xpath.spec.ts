
import { expect } from 'chai';
import { xpathToElIdOrIds } from '../../lib/xpath';
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
