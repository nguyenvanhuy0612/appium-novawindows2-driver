
import { expect } from 'chai';
import { UI_AUTOMATION_DRIVER_CONSTRAINTS } from '../../lib/constraints';

describe('Driver Constraints', () => {
    it('should have required platformName constraint', () => {
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS).to.have.property('platformName');
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS.platformName.presence).to.be.true;
    });

    it('should allow typeDelay capability', () => {
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS).to.have.property('typeDelay');
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS.typeDelay.isNumber).to.be.true;
    });

    it('should allow smoothPointerMove capability', () => {
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS).to.have.property('smoothPointerMove');
        expect(UI_AUTOMATION_DRIVER_CONSTRAINTS.smoothPointerMove.isString).to.be.true;
    });
});
