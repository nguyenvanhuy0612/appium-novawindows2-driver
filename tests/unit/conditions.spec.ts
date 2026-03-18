
import { expect } from 'chai';
import {
    PropertyCondition,
    AndCondition,
    OrCondition,
    NotCondition,
    TrueCondition,
    FalseCondition,
    Property,
    PSString,
    PSBoolean,
    PSInt32,
    PSInt32Array,
    PSRect,
    PSPoint,
    Condition
} from '../../lib/powershell';

describe('UIA Conditions', () => {
    describe('PropertyCondition', () => {
        it('generates correct PowerShell for StringProperty', () => {
            const cond = new PropertyCondition(Property.NAME, new PSString('Calc'));
            expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::nameProperty, "$([char]0x0043)$([char]0x0061)$([char]0x006c)$([char]0x0063)")');
        });

        it('generates correct PowerShell for BooleanProperty', () => {
            const cond = new PropertyCondition(Property.IS_ENABLED, new PSBoolean(true));
            expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::isenabledProperty, $true)');
        });

        it('generates correct PowerShell for Int32Property', () => {
            const cond = new PropertyCondition(Property.PROCESS_ID, new PSInt32(1234));
            expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::processidProperty, 1234)');
        });
        
        it('generates correct PowerShell for RectProperty', () => {
             const cond = new PropertyCondition(Property.BOUNDING_RECTANGLE, new PSRect({ x: 1, y: 2, width: 3, height: 4 }));
             expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::boundingrectangleProperty, [System.Windows.Rect]::new(1, 2, 3, 4))');
        });

        it('generates correct PowerShell for PointProperty', () => {
             const cond = new PropertyCondition(Property.CLICKABLE_POINT, new PSPoint({ x: 10, y: 20 }));
             expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::clickablepointProperty, [System.Windows.Point]::new(10, 20))');
        });

        it('generates correct PowerShell for Int32ArrayProperty', () => {
             const cond = new PropertyCondition(Property.RUNTIME_ID, new PSInt32Array([1, 2, 3]));
             expect(cond.toString()).to.equal('[PropertyCondition]::new([AutomationElement]::runtimeidProperty, [int32[]] @(1, 2, 3))');
        });

        it('throws error on type mismatch', () => {
            // @ts-ignore
            expect(() => new PropertyCondition(Property.NAME, new PSBoolean(true))).to.throw(/expected type PSString/);
            // @ts-ignore
            expect(() => new PropertyCondition(Property.IS_ENABLED, new PSString('true'))).to.throw(/expected type PSBoolean/);
        });
    });

    describe('Composite Conditions', () => {
        const c1 = new PropertyCondition(Property.NAME, new PSString('A'));
        const c2 = new PropertyCondition(Property.CLASS_NAME, new PSString('B'));
        const c3 = new PropertyCondition(Property.AUTOMATION_ID, new PSString('C'));

        it('AndCondition generates correct PowerShell', () => {
            const and = new AndCondition(c1, c2);
            expect(and.toString()).to.contain('[AndCondition]::new(');
            expect(and.toString()).to.contain(c1.toString());
            expect(and.toString()).to.contain(c2.toString());
        });

        it('OrCondition generates correct PowerShell', () => {
            const or = new OrCondition(c1, c2);
            expect(or.toString()).to.contain('[OrCondition]::new(');
        });

        it('OrCondition handles more than 2 arguments', () => {
             const or = new OrCondition(c1, c2, c3);
             expect(or.toString()).to.contain(c1.toString());
             expect(or.toString()).to.contain(c2.toString());
             expect(or.toString()).to.contain(c3.toString());
        });

        it('NotCondition generates correct PowerShell', () => {
            const not = new NotCondition(c1);
            expect(not.toString()).to.equal(`[NotCondition]::new(${c1.toString()})`);
        });

        it('Nested conditions (depth 2) generate correct PowerShell', () => {
            const nested = new AndCondition(c1, new OrCondition(c2, new TrueCondition()));
            expect(nested.toString()).to.contain('[AndCondition]::new(');
            expect(nested.toString()).to.contain('[OrCondition]::new(');
            expect(nested.toString()).to.contain('[Condition]::TrueCondition');
        });

        it('Deeply nested conditions (depth 3+) generate correct PowerShell', () => {
             const deep = new OrCondition(
                 new AndCondition(c1, c2),
                 new NotCondition(new AndCondition(c3, new FalseCondition()))
             );
             expect(deep.toString()).to.contain('[OrCondition]::new(');
             expect(deep.toString()).to.contain('[AndCondition]::new(');
             expect(deep.toString()).to.contain('[NotCondition]::new(');
        });
    });

    describe('Basic Conditions', () => {
        it('TrueCondition', () => {
            expect(new TrueCondition().toString()).to.equal('[Condition]::TrueCondition');
        });

        it('FalseCondition', () => {
            expect(new FalseCondition().toString()).to.equal('[Condition]::FalseCondition');
        });
        
        it('Conditions are persistent objects', () => {
             const t = new TrueCondition();
             expect(t).to.be.an.instanceOf(Condition);
        });
    });

    describe('Property Enum coverage', () => {
         it('Has HEADING_LEVEL property', () => {
              expect(Property.HEADING_LEVEL).to.equal('headinglevel');
         });
         it('Has CULTURE property', () => {
              expect(Property.CULTURE).to.equal('culture');
         });
    });
});
