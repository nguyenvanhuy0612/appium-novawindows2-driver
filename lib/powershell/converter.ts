import { errors } from '@appium/base-driver';
import {
    ConstructorRegexMatcher,
    PropertyRegexMatcher,
    RegexItem,
    StringRegexMatcher,
    VarArgsRegexMatcher,
} from './regex';
import {
    AndCondition,
    Condition,
    FalseCondition,
    NotCondition,
    OrCondition,
    PropertyCondition,
    TrueCondition,
} from './conditions';
import {
    AutomationHeadingLevel,
    ControlType,
    ExtraControlType,
    OrientationType,
    Property,
} from './types';
import { PSObject } from './core';
import {
    PSAutomationHeadingLevel,
    PSBoolean,
    PSControlType,
    PSCultureInfo,
    PSInt32,
    PSInt32Array,
    PSOrientationType,
    PSPoint,
    PSRect,
    PSString,
} from './common';

const BOOLEAN_REGEX = /(?<=[\s,])(?:\$)?(true|false)(?=[\s)])/;
const INTEGER_REGEX = /((?<![\d.+-])[+-]?\d+(?![\d.]))/;
const POSITIVE_INTEGER_REGEX = /((?<![\d.+-])[+]?\d+(?![\d.]))/;
const FLOATING_POINT_NUMBER_REGEX = /((?<![\d.+-])[+-]?(?:\d*[.])?\d+(?![\d.]))/;
const POSITIVE_FLOATING_POINT_NUMBER_REGEX = /((?<![\d.+-])[+]?(?:\d*[.])?\d+(?![\d.]))/;
const DOUBLE_QUOTE_STRINGS_REGEX = /"([^"`]|`.)*(?:[^"]*)*"/g;
const PROCESSED_STRING_RESULT_MATCH_REGEX = /^[\uEE00-\uEFFF]{1}$/;
const PROCESSED_ITEMS_REGEX = /[\uEE00-\uEFFF]/g;

const BOOLEAN_MATCHER = new RegexItem(BOOLEAN_REGEX.source);
const INTEGER_MATCHER = new RegexItem(INTEGER_REGEX.source);
const POSITIVE_INTEGER_MATCHER = new RegexItem(POSITIVE_INTEGER_REGEX.source);
const FLOATING_POINT_NUMBER_MATCHER = new RegexItem(FLOATING_POINT_NUMBER_REGEX.source);
const POSITIVE_FLOATING_POINT_NUMBER_MATCHER = new RegexItem(POSITIVE_FLOATING_POINT_NUMBER_REGEX.source);
const PROCESSED_ITEM_REGEX_MATCHER = new RegexItem(`(${PROCESSED_ITEMS_REGEX.source}{1})`);
const POINT_REGEX_MATCHER = new ConstructorRegexMatcher('System.Windows.Point', FLOATING_POINT_NUMBER_MATCHER, FLOATING_POINT_NUMBER_MATCHER);
const SIZE_REGEX_MATCHER = new ConstructorRegexMatcher('System.Windows.Size', POSITIVE_FLOATING_POINT_NUMBER_MATCHER, POSITIVE_FLOATING_POINT_NUMBER_MATCHER);
const VECTOR_REGEX_MATCHER = new ConstructorRegexMatcher('System.Windows.Vector', FLOATING_POINT_NUMBER_MATCHER, FLOATING_POINT_NUMBER_MATCHER);

const STRING_REGEX = new StringRegexMatcher().toRegex('gi');

const PROPERTY_CONDITION_REGEX = new ConstructorRegexMatcher('System.Windows.Automation.Property(?:Condition)?', new PropertyRegexMatcher('System.Windows.Automation.AutomationElement'), PROCESSED_ITEM_REGEX_MATCHER).toRegex('gi');
const ANY_LOGIC_CONDITION_REGEX = new ConstructorRegexMatcher('System.Windows.Automation.(?:And|Or|Not)(?:Condition)?', new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER)).toRegex('i'); // not global as it will be used for test

const AND_CONDITION_REGEX = new ConstructorRegexMatcher('System.Windows.Automation.And(?:Condition)?', new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER)).toRegex('gi');
const OR_CONDITION_REGEX = new ConstructorRegexMatcher('System.Windows.Automation.Or(?:Condition)?', new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER)).toRegex('gi');
const NOT_CONDITION_REGEX = new ConstructorRegexMatcher('System.Windows.Automation.Not(?:Condition)?', new VarArgsRegexMatcher(PROCESSED_ITEM_REGEX_MATCHER)).toRegex('gi');

const TRUE_CONDITION_REGEX = new PropertyRegexMatcher('System.Windows.Automation.(?:Property)Condition', `True(?:Condition)?`).toRegex('gi');
const FALSE_CONDITION_REGEX = new PropertyRegexMatcher('System.Windows.Automation.(?:Property)Condition', `False(?:Condition)?`).toRegex('gi');

const RAW_VIEW_CONDITION_REGEX = new PropertyRegexMatcher('System.Windows.Automation.Automation', `RawView(?:Condition)?`).toRegex('gi');
const CONTROL_VIEW_CONDITION_REGEX = new PropertyRegexMatcher('System.Windows.Automation.Automation', `ControlView(?:Condition)?`).toRegex('gi');
const CONTENT_VIEW_CONDITION_REGEX = new PropertyRegexMatcher('System.Windows.Automation.Automation', `ContentView(?:Condition)?`).toRegex('gi');

const POINT_PARAMETER_REGEX = POINT_REGEX_MATCHER.toRegex('gi');
const SIZE_PARAMETER_REGEX = SIZE_REGEX_MATCHER.toRegex('gi');
const VECTOR_PARAMETER_REGEX = VECTOR_REGEX_MATCHER.toRegex('gi');

const RECT_PARAMETER_REGEX_C1 = new ConstructorRegexMatcher('System.Windows.Rect', POINT_REGEX_MATCHER, SIZE_REGEX_MATCHER).toRegex('gi');
const RECT_PARAMETER_REGEX_C2 = new ConstructorRegexMatcher('System.Windows.Rect', FLOATING_POINT_NUMBER_MATCHER, FLOATING_POINT_NUMBER_MATCHER, FLOATING_POINT_NUMBER_MATCHER, FLOATING_POINT_NUMBER_MATCHER).toRegex('gi');
const RECT_PARAMETER_REGEX_C3 = new ConstructorRegexMatcher('System.Windows.Rect', POINT_REGEX_MATCHER, POINT_REGEX_MATCHER).toRegex('gi');
const RECT_PARAMETER_REGEX_C4 = new ConstructorRegexMatcher('System.Windows.Rect', POINT_REGEX_MATCHER, VECTOR_REGEX_MATCHER).toRegex('gi');
const RECT_PARAMETER_REGEX_C5 = new ConstructorRegexMatcher('System.Windows.Rect', SIZE_REGEX_MATCHER).toRegex('gi');

const AUTOMATION_HEADING_LEVEL_PARAMETER_REGEX = new PropertyRegexMatcher('System.Windows.Automation.AutomationHeadingLevel', ...Object.values(AutomationHeadingLevel)).toRegex('gi');
const ORIENTATION_TYPE_PARAMETER_REGEX = new PropertyRegexMatcher('System.Windows.Automation.OrientationType', ...Object.values(OrientationType)).toRegex('gi');
const CONTROL_TYPE_PARAMETER_REGEX = new PropertyRegexMatcher('System.Windows.Automation.ControlType', ...Object.values(ControlType), ...Object.values(ExtraControlType)).toRegex('gi');

const CULTURE_INFO_PARAMETER_REGEX_C1 = new ConstructorRegexMatcher('System.Globalization.CultureInfo', new StringRegexMatcher()).toRegex('gi');
const CULTURE_INFO_PARAMETER_REGEX_C2 = new ConstructorRegexMatcher('System.Globalization.CultureInfo', new StringRegexMatcher(), BOOLEAN_MATCHER).toRegex('gi');
const CULTURE_INFO_PARAMETER_REGEX_C3 = new ConstructorRegexMatcher('System.Globalization.CultureInfo', POSITIVE_INTEGER_MATCHER).toRegex('gi');
const CULTURE_INFO_PARAMETER_REGEX_C4 = new ConstructorRegexMatcher('System.Globalization.CultureInfo', POSITIVE_INTEGER_MATCHER, BOOLEAN_MATCHER).toRegex('gi');

const INTEGER_PARAMETER_REGEX = INTEGER_MATCHER.toRegex('g');
const INTEGER_ARRAY_PARAMETER_REGEX = /(?:(?:(?:(?:new\s+)?\bint(?:32)?\[\])|(?:\[int(?:32)?\[\]\]))\s*)?(?:(?:@\((?=\s*\d+(?:\s*,\s*\d+)*\s*\)))|(?:\[(?=\s*\d+(?:\s*,\s*\d+)*\s*\]))|(?:\{(?=\s*\d+(?:\s*,\s*\d+)*\s*\})))\s*(\d+(?:\s*,\s*\d+)*)\s*(?:\)|\]|\})/gi;

const MAGIC_PLACEHOLDER_UNICODE_BEGIN = 0xEE00;
const PROPERTY_SUFFIX = 'property';

class WindowsAutomationSelectorSyntaxError extends errors.InvalidSelectorError {
    constructor(selector: string, extraInfo?: string) {
        super(`Could not parse Windows Automation selector expression '${selector}'.${extraInfo ? ` ${extraInfo}.` : ''}`);
    }
}

export function convertStringToCondition(selector: string): Condition {
    if (PROCESSED_ITEMS_REGEX.test(selector)) {
        throw new WindowsAutomationSelectorSyntaxError(selector, 'Selector contains restricted characters in the Unicode Private Use Area (\\uEE00-\\uEFFF).');
    }

    const processedItems: PSObject[] = [];
    let processedSelector = selector;

    // Handle double-quoted strings first
    processedSelector = processedSelector.replaceAll(DOUBLE_QUOTE_STRINGS_REGEX, (match) => {
        const placeholderMap = {
            '``': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1000), // temp range
            '`0': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1001),
            '`a': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1002),
            '`b': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1003),
            '`f': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1004),
            '`n': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1005),
            '`r': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1006),
            '`t': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1007),
            '`v': String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + 0x1008),
        };

        let value = match.slice(1, match.length - 1);

        // removing the ` that is not an escape sequence
        const escapeChars = Object.keys(placeholderMap).map((x) => x.charAt(1)).join('');
        value = value.replaceAll(RegExp(`(\`)[^${escapeChars}]`, 'g'), '');

        for (const entry in placeholderMap) {
            value = value.replaceAll(entry, placeholderMap[entry as keyof typeof placeholderMap]);
        }

        value = value.replaceAll(placeholderMap['``'], '`');
        value = value.replaceAll(placeholderMap['`0'], '\0');
        value = value.replaceAll(placeholderMap['`a'], '\u0007');
        value = value.replaceAll(placeholderMap['`b'], '\b');
        value = value.replaceAll(placeholderMap['`f'], '\f');
        value = value.replaceAll(placeholderMap['`n'], '\n');
        value = value.replaceAll(placeholderMap['`r'], '\r');
        value = value.replaceAll(placeholderMap['`t'], '\t');
        value = value.replaceAll(placeholderMap['`v'], '\v');

        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSString(value));
        return replacementChar;
    });

    // it's important to process the strings first as they can contain other tokens that may be matched later
    processedSelector = processedSelector.replaceAll(STRING_REGEX, (match) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSString(match.slice(1, match.length - 1).replace(`''`, `'`)));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(INTEGER_ARRAY_PARAMETER_REGEX, (_, value: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSInt32Array(value.split(',').map(Number)));
        return replacementChar;
    });

    // For RECT_PARAMETER_REGEX_C{1,3,4,5}, the outer regex *embeds* the inner
    // matchers (Point / Size / Vector / floating-point number) verbatim, so
    // each nested matcher's capture groups become flat numbered captures on
    // the outer regex. The replaceAll callback receives them as positional
    // args after the full match. Two pre-fix bugs lived here:
    //   1. The callback signatures only declared 1-2 args (point/size as
    //      strings) — they were actually getting the inner X/Y as strings.
    //   2. The body re-ran the inner regex with `.groups` (unnamed groups
    //      → undefined → fallback to []) → Number(undefined) = NaN.
    // Both fixed below by reading the four flat captures directly.
    processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C1, (_, px: string, py: string, sw: string, sh: string) => {
        // Rect(Point(x, y), Size(w, h)) — 4 numeric captures.
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSRect({ x: Number(px), y: Number(py), width: Number(sw), height: Number(sh) }));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C2, (_, x: string, y: string, width: string, height: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSRect({ x: Number(x), y: Number(y), width: Number(width), height: Number(height) }));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C3, (_, p1x: string, p1y: string, p2x: string, p2y: string) => {
        // Rect(Point(x1, y1), Point(x2, y2)) — 4 numeric captures.
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        const x = Math.min(Number(p1x), Number(p2x));
        const y = Math.min(Number(p1y), Number(p2y));
        const width = Math.abs(Number(p2x) - Number(p1x));
        const height = Math.abs(Number(p2y) - Number(p1y));

        processedItems.push(new PSRect({ x, y, width, height }));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C4, (_, px: string, py: string, vx: string, vy: string) => {
        // Rect(Point(x, y), Vector(vx, vy)) — 4 numeric captures.
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        const x = Number(vx) < 0 ? Number(px) + Number(vx) : Number(px);
        const y = Number(vy) < 0 ? Number(py) + Number(vy) : Number(py);
        const width = Number(vx) < 0 ? Math.abs(Number(vx)) : Number(vx);
        const height = Number(vy) < 0 ? Math.abs(Number(vy)) : Number(vy);

        processedItems.push(new PSRect({ x, y, width, height }));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(RECT_PARAMETER_REGEX_C5, (_, sw: string, sh: string) => {
        // Rect(Size(w, h)) — 2 numeric captures.
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSRect({ x: 0, y: 0, width: Number(sw), height: Number(sh) }));
        return replacementChar;
    });

    // it's important to process Rect before Point as some of Rect's constructors contain Point or Points
    processedSelector = processedSelector.replaceAll(POINT_PARAMETER_REGEX, (_, x: string, y: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSPoint({ x: Number(x), y: Number(y) }));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(AUTOMATION_HEADING_LEVEL_PARAMETER_REGEX, (_, value: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSAutomationHeadingLevel(value));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(ORIENTATION_TYPE_PARAMETER_REGEX, (_, value: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSOrientationType(value));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CONTROL_TYPE_PARAMETER_REGEX, (_, value: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSControlType(value));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C1, (_, name: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSCultureInfo(name));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C2, (_, name: string, useUserOverride: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSCultureInfo(name, Boolean(useUserOverride)));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C3, (_, culture: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSCultureInfo(Number(culture)));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CULTURE_INFO_PARAMETER_REGEX_C4, (_, culture: string, useUserOverride: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSCultureInfo(Number(culture), Boolean(useUserOverride)));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(INTEGER_PARAMETER_REGEX, (match) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new PSInt32(Number(match)));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(TRUE_CONDITION_REGEX, () => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new TrueCondition());
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(FALSE_CONDITION_REGEX, () => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new FalseCondition());
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(RAW_VIEW_CONDITION_REGEX, () => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new TrueCondition());
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CONTROL_VIEW_CONDITION_REGEX, () => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new NotCondition(new PropertyCondition(Property.IS_CONTROL_ELEMENT, new PSBoolean(false))));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(CONTENT_VIEW_CONDITION_REGEX, () => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        processedItems.push(new NotCondition(new OrCondition(new PropertyCondition(Property.IS_CONTROL_ELEMENT, new PSBoolean(false)), new PropertyCondition(Property.IS_CONTENT_ELEMENT, new PSBoolean(false)))));
        return replacementChar;
    });

    processedSelector = processedSelector.replaceAll(PROPERTY_CONDITION_REGEX, (_, property: string, processedItem: string) => {
        const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
        property = property.toLowerCase();

        if (property.endsWith(PROPERTY_SUFFIX)) {
            property = property.slice(0, property.length - PROPERTY_SUFFIX.length);
        }

        if (!Object.values(Property).includes(property as Property)) {
            throw new errors.InvalidArgumentError();
        }

        const propertyValue = processedItems[processedItem.trim().charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN];

        // workaround for ControlType 50039 and 50040 not supported in UIAutomationClient
        if (propertyValue instanceof PSControlType && Object.values(ExtraControlType).includes(propertyValue.toString().toLocaleLowerCase() as ExtraControlType)) {
            processedItems.push(new PropertyCondition(Property.LOCALIZED_CONTROL_TYPE, new PSString(propertyValue.toString())));
        } else if (property === Property.CONTROL_TYPE && propertyValue instanceof PSControlType) {
            const val = propertyValue.toString().toLowerCase();
            if (val.endsWith('::list')) {
                processedItems.push(new OrCondition(
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('List')),
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataGrid'))
                ));
            } else if (val.endsWith('::listitem')) {
                processedItems.push(new OrCondition(
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('ListItem')),
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataItem'))
                ));
            } else {
                processedItems.push(new PropertyCondition(property as Property, propertyValue));
            }
        } else {
            processedItems.push(new PropertyCondition(property as Property, propertyValue));
        }


        return replacementChar;
    });

    while (ANY_LOGIC_CONDITION_REGEX.test(processedSelector)) {
        processedSelector = processedSelector.replaceAll(AND_CONDITION_REGEX, (_, content: string) => {
            const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
            const args = content.split(',').map((x) => x.trim()).map((x) => processedItems[x.charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN]);

            if (args.length < 2) {
                throw new WindowsAutomationSelectorSyntaxError(selector, 'expected AND condition to have at least 2 arguments');
            }

            processedItems.push(new AndCondition(...args));
            return replacementChar;
        });

        processedSelector = processedSelector.replaceAll(OR_CONDITION_REGEX, (_, content: string) => {
            const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
            const args = content.split(',').map((x) => x.trim()).map((x) => processedItems[x.charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN]);

            if (args.length < 2) {
                throw new WindowsAutomationSelectorSyntaxError(selector, 'expected OR condition to have at least 2 arguments');
            }

            processedItems.push(new OrCondition(...args));
            return replacementChar;
        });

        processedSelector = processedSelector.replaceAll(NOT_CONDITION_REGEX, (_, content: string) => {
            const replacementChar = String.fromCharCode(MAGIC_PLACEHOLDER_UNICODE_BEGIN + processedItems.length);
            const args = content.split(',').map((x) => x.trim()).map((x) => processedItems[x.charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN]);

            if (args.length !== 1) {
                throw new WindowsAutomationSelectorSyntaxError(selector, 'expected NOT condition to have exactly 1 arguments');
            }

            processedItems.push(new NotCondition(args[0]));
            return replacementChar;
        });

        processedSelector = processedSelector.trim();
    }

    if (!PROCESSED_STRING_RESULT_MATCH_REGEX.test(processedSelector)) {
        throw new WindowsAutomationSelectorSyntaxError(selector, `Some parts of the selector were left unprocessed: '${processedSelector.replaceAll(PROCESSED_ITEMS_REGEX, '<processed>')}'`);
    }

    const condition = processedItems[processedSelector.trim().charCodeAt(0) - MAGIC_PLACEHOLDER_UNICODE_BEGIN];

    if (!(condition instanceof Condition)) {
        throw new WindowsAutomationSelectorSyntaxError(selector, 'The selector must be of type System.Windows.Automation.Condition.');
    }

    return condition;
}