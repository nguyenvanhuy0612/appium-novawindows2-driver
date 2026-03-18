
import { expect } from 'chai';
import { convertStringToCondition } from '../../lib/powershell/converter';
import {
    PropertyCondition,
    AndCondition,
    OrCondition,
    NotCondition,
    TrueCondition,
    FalseCondition
} from '../../lib/powershell';

describe('Condition Converter', () => {
    it('parses basic PropertyCondition', () => {
        const cond = convertStringToCondition('new PropertyCondition(NameProperty, "Calc")');
        expect(cond.constructor.name).to.equal('PropertyCondition');
        expect(cond.toString()).to.contain('nameProperty');
        // "Calc" is encoded as $([char]0x0043)$([char]0x0061)$([char]0x006c)$([char]0x0063)
        expect(cond.toString()).to.contain('0043');
        expect(cond.toString()).to.contain('0061');
    });

    it('parses TrueCondition and FalseCondition', () => {
        expect(convertStringToCondition('TrueCondition').constructor.name).to.equal('TrueCondition');
        expect(convertStringToCondition('FalseCondition').constructor.name).to.equal('FalseCondition');
    });

    it('parses AndCondition with multiple arguments and nesting', () => {
        const selector = 'new AndCondition(new PropertyCondition(NameProperty, "A"), new PropertyCondition(ClassNameProperty, "B"))';
        const cond = convertStringToCondition(selector);
        expect(cond.constructor.name).to.equal('AndCondition');
        
        const nested = 'new AndCondition(TrueCondition, new NotCondition(FalseCondition))';
        expect(convertStringToCondition(nested).constructor.name).to.equal('AndCondition');
    });

    it('parses NotCondition', () => {
        const cond = convertStringToCondition('new NotCondition(TrueCondition)');
        expect(cond.constructor.name).to.equal('NotCondition');
    });

    it('handles deeply nested complex expressions', () => {
         const script = 'new OrCondition(new AndCondition(new PropertyCondition(Name, "1"), new PropertyCondition(Name, "2")), new NotCondition(TrueCondition))';
         const cond = convertStringToCondition(script);
         expect(cond.constructor.name).to.equal('OrCondition');
    });

    it('handles special List mapping', () => {
        const cond = convertStringToCondition('new PropertyCondition(ControlTypeProperty, List)');
        expect(cond.constructor.name).to.equal('OrCondition');
        expect(cond.toString()).to.contain('List');
        expect(cond.toString()).to.contain('DataGrid');
    });

    it('handles special ListItem mapping', () => {
        const cond = convertStringToCondition('new PropertyCondition(ControlTypeProperty, ListItem)');
        expect(cond.constructor.name).to.equal('OrCondition');
        expect(cond.toString()).to.contain('ListItem');
        expect(cond.toString()).to.contain('DataItem');
    });

    it('parses View conditions', () => {
        expect(convertStringToCondition('RawViewCondition').constructor.name).to.equal('TrueCondition');
        expect(convertStringToCondition('ControlViewCondition').constructor.name).to.equal('NotCondition');
        expect(convertStringToCondition('ContentViewCondition').constructor.name).to.equal('NotCondition');
    });

    it('handles quoted strings with escape characters and PUA', () => {
        const cond = convertStringToCondition('new PropertyCondition(NameProperty, "Line1`nLine2")');
        expect(cond.toString()).to.contain('000a'); // \n is 0x000a

        const puaCond = convertStringToCondition('new PropertyCondition(Name, "\uE000")');
        expect(puaCond.toString()).to.contain('e000');
    });

    it('throws error on malformed selector syntax', () => {
        expect(() => convertStringToCondition('Invalid(Selector)')).to.throw(/Could not parse/);
        expect(() => convertStringToCondition('new AndCondition(TrueCondition')).to.throw(/Could not parse/);
        expect(() => convertStringToCondition('new PropertyCondition(Name "MissingComma")')).to.throw(/Could not parse/);
    });

    it('throws error on unknown classes or dot-prefixed properties', () => {
         expect(() => convertStringToCondition('new FakeClass(TrueCondition)')).to.throw();
         expect(() => convertStringToCondition('new PropertyCondition(AutomationElement.NameProperty, "Calc")')).to.throw(/Could not parse/);
         expect(() => convertStringToCondition('new PropertyCondition(ControlType.List, "Calc")')).to.throw(/Could not parse/);
    });
});
