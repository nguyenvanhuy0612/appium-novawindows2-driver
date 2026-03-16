import { expect } from 'chai';
import { predicateProcessableBeforeNode } from '../../lib/xpath/core';
import {
    EQUALITY,
    INEQUALITY,
    OR,
    AND,
    RELATIVE_LOCATION_PATH,
    ATTRIBUTE,
    NODE_NAME_TEST,
    LITERAL,
} from 'xpath-analyzer';

function makeAttrStep(name: string) {
    return {
        axis: ATTRIBUTE,
        test: { type: NODE_NAME_TEST, name },
        predicates: [],
    };
}

function makeAttrLoc(name: string) {
    return {
        type: RELATIVE_LOCATION_PATH,
        steps: [makeAttrStep(name)],
    };
}

function makeLiteral(value: string) {
    return { type: LITERAL, string: value };
}

function makeEq(lhs: any, rhs: any, type = EQUALITY) {
    return { type, lhs, rhs };
}

describe('predicateProcessableBeforeNode — @* wildcard', () => {
    it('returns true for @* = "value" (lhs wildcard)', () => {
        const node = makeEq(makeAttrLoc('*'), makeLiteral('someValue'));
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns true for "value" = @* (rhs wildcard)', () => {
        const node = makeEq(makeLiteral('someValue'), makeAttrLoc('*'));
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns true for @* != "value" (inequality lhs wildcard)', () => {
        const node = makeEq(makeAttrLoc('*'), makeLiteral('someValue'), INEQUALITY);
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns true for "value" != @* (inequality rhs wildcard)', () => {
        const node = makeEq(makeLiteral('someValue'), makeAttrLoc('*'), INEQUALITY);
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns true for known attribute @Name = "value"', () => {
        const node = makeEq(makeAttrLoc('name'), makeLiteral('calc'));
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns true for @AutomationId = "value"', () => {
        const node = makeEq(makeAttrLoc('automationid'), makeLiteral('btn1'));
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns false for unknown attribute @customProp = "value"', () => {
        const node = makeEq(makeAttrLoc('customProp'), makeLiteral('val'));
        expect(predicateProcessableBeforeNode(node as any)).to.be.false;
    });

    it('returns true for AND of two processable predicates', () => {
        const node = {
            type: AND,
            lhs: makeEq(makeAttrLoc('*'), makeLiteral('v1')),
            rhs: makeEq(makeAttrLoc('name'), makeLiteral('v2')),
        };
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });

    it('returns false for AND where one side is not processable', () => {
        const node = {
            type: AND,
            lhs: makeEq(makeAttrLoc('*'), makeLiteral('v1')),
            rhs: makeEq(makeAttrLoc('customProp'), makeLiteral('v2')),
        };
        expect(predicateProcessableBeforeNode(node as any)).to.be.false;
    });

    it('returns true for OR of two processable predicates', () => {
        const node = {
            type: OR,
            lhs: makeEq(makeAttrLoc('*'), makeLiteral('v1')),
            rhs: makeEq(makeAttrLoc('name'), makeLiteral('v2')),
        };
        expect(predicateProcessableBeforeNode(node as any)).to.be.true;
    });
});
