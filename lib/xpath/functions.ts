import { errors } from '@appium/base-driver';

import {
    FunctionName,
    ExprNode,
    BOOLEAN,
    CONCAT,
    CONTAINS,
    COUNT,
    FALSE,
    ROUND,
    CEILING,
    FLOOR,
    ID,
    LAST,
    LOCAL_NAME,
    NAME,
    NORMALIZE_SPACE,
    NOT,
    POSITION,
    STARTS_WITH,
    STRING_LENGTH,
    NUMBER,
    STRING,
    SUBSTRING_AFTER,
    SUBSTRING_BEFORE,
    SUBSTRING,
    SUM,
    TRANSLATE,
    TRUE
} from 'xpath-analyzer';

import { AutomationElement, PropertyCondition, Property, PSInt32Array, TreeScope, FoundAutomationElement } from '../powershell';
import { $ } from '../util';
import { XPathExecutor } from './core';

const FUNCTION_ARGUMENT_ERROR = $`Function ${0}() requires ${1}.`;

export async function handleFunctionCall<T>(name: FunctionName, context: AutomationElement, executor: XPathExecutor, contextState: [number, number] | undefined, ...args: ExprNode[]): Promise<T[]> {
    const processArgs = async <T>(...args: ExprNode[]): Promise<T[][]> => {
        const results: T[][] = [];
        for (const arg of args) {
            results.push(await executor.processExprNode(arg, context, contextState));
        }

        return results;
    };

    switch (name) {
        case NOT:
        case BOOLEAN: {
            if (args.length !== 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 1 argument'));
            }

            const [resultArray] = await processArgs(args[0]);
            const result = Boolean(resultArray[0]);
            return [name === NOT ? !result as T : result as T];
        }
        case CONCAT: {
            if (args.length < 2) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'at least 2 arguments'));
            }

            const resultArrays = await processArgs(...args);
            if (resultArrays.some((resultArray) => resultArray.length > 1)) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to have either one or zero elements'));
            }

            const stringArray = convertProcessedExprNodesToStrings(...resultArrays.map((resultArray) => resultArray[0]));
            return [String.prototype.concat(...stringArray) as T];
        }
        case STARTS_WITH:
        case CONTAINS: {
            if (args.length !== 2) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 2 arguments'));
            }

            // Optimization: Evaluate the search string (rhs) first. 
            // If it is empty, standard XPath 1.0 logic dictates it matches anything (is always true).
            // This prevents expensive @* wildcard retrieval when it's not needed.
            const secondArgResult = await executor.processExprNode(args[1], context, contextState);
            if (secondArgResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the second argument to have either one or zero elements'));
            }

            const [rhs] = secondArgResult;
            if (typeof rhs === 'boolean') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the second argument to be string, number or element'));
            }

            const [rhsString] = convertProcessedExprNodesToStrings(secondArgResult);
            if (rhsString === '') {
                return [true as T];
            }

            const [firstArgResult] = await processArgs<string | boolean | AutomationElement>(args[0]);

            const stringMethodMap = {
                [STARTS_WITH]: 'startsWith',
                [CONTAINS]: 'includes',
            } as const satisfies Record<typeof name, keyof string>;

            // @* wildcard: check if ANY attribute value satisfies the condition
            if (firstArgResult.length > 1) {
                return [firstArgResult.some((v) => {
                    const vStr = typeof v === 'string' ? v : '';
                    return (vStr as any)[stringMethodMap[name]](rhsString);
                }) as T];
            }

            const [lhs] = firstArgResult;

            if (typeof lhs === 'boolean') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be string, number or element'));
            }

            const [lhsString] = convertProcessedExprNodesToStrings(firstArgResult);
            return [lhsString[stringMethodMap[name]](rhsString) as T];
        }
        case COUNT: {
            if (args.length !== 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 1 argument'));
            }

            const resultArray = await processArgs(args[0]);
            return [resultArray.length as T];
        }
        case TRUE:
        case FALSE:
            if (args.length > 0) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'to have 0 arguments'));
            }

            return [name === TRUE ? true as T : false as T];
        case ROUND:
        case CEILING:
        case FLOOR: {
            if (args.length !== 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 1 argument'));
            }

            const resultArray = await processArgs(args[0]);
            const [num] = resultArray[0];
            if (typeof num !== 'number') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be a number'));
            }

            const mathMethodMap = {
                [ROUND]: 'round',
                [FLOOR]: 'floor',
                [CEILING]: 'ceil',
            } as const satisfies Record<typeof name, keyof Math>;

            return [Math[mathMethodMap[name]](num) as T];
        }
        case ID: {
            if (args.length !== 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 1 argument'));
            }

            const resultArray = await processArgs(args[0]);
            const stringArray = convertProcessedExprNodesToStrings(...resultArray);

            const ids = Array.from(new Set(stringArray.flatMap((string) => string.split(/\s+/))));
            const conditions = ids.map((id) => new PropertyCondition(Property.RUNTIME_ID, new PSInt32Array(id.split('.').map(Number))));
            const results: string[] = [];
            for (const condition of conditions) {
                results.push(await executor.sendPowerShellCommand(AutomationElement.rootElement.findFirst(TreeScope.SUBTREE, condition).buildCommand()));
            }

            return results.map((result) => new FoundAutomationElement(result.trim()) as T);
        }
        case POSITION:
        case LAST: {
            if (args.length > 0) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'to have 0 arguments'));
            }

            if (name === POSITION && contextState) {
                return [contextState[0] as T];
            }

            if (name === LAST && contextState) {
                return [contextState[1] as T];
            }

            const elIds = await executor.sendPowerShellCommand(context.buildCommand());
            const lastElementIndex = elIds.split('\n').map((id) => id.trim()).filter(Boolean).length;
            return name === LAST ? [lastElementIndex as T] : Array.from({ length: lastElementIndex }, () => 0 as T);
        }
        case LOCAL_NAME:
        case NAME: {
            if (args.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'no more than 1 argument'));
            }

            const [argResult] = await processArgs<AutomationElement>(args[0]);

            if (argResult && argResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to have either one or zero elements'));
            }

            const [element] = argResult ?? [context];

            if (!(element instanceof AutomationElement)) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be element'));
            }

            const result = await executor.sendPowerShellCommand(element.buildGetTagNameCommand());
            return result.split('\n').map((x) => x.trim() as T);
        }
        case NORMALIZE_SPACE: {
            if (args.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'no more than 1 argument'));
            }

            const [argResult] = await processArgs<AutomationElement | string>(args[0]);

            if (argResult && argResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to have either one or zero elements'));
            }

            if (!argResult[0] || argResult[0] instanceof AutomationElement) {
                return ['' as T];
            }

            if (typeof argResult[0] === 'string') {
                return [argResult[0].trim().replace(/\s+/g, ' ') as T];
            }

            throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be string or element'));
        }
        case STRING_LENGTH: {
            if (args.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'no more than 1 argument'));
            }

            const [argResult] = await processArgs<AutomationElement | string>(args[0]);

            if (argResult && argResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to have either one or zero elements'));
            }

            if (!argResult[0] || argResult[0] instanceof AutomationElement) {
                return [0 as T];
            }

            if (typeof argResult[0] === 'string') {
                return [argResult[0].length as T];
            }

            throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be string or element'));
        }
        case TRANSLATE: {
            if (args.length !== 3) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 3 arguments'));
            }

            const [firstArgResult, secondArgResult, thirdArgResult] = await processArgs<string | AutomationElement>(args[0], args[1], args[2]);

            if (firstArgResult.length > 1 || secondArgResult.length > 1 || thirdArgResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to have either one or zero elements'));
            }

            const [[str], [from], [to]] = [firstArgResult, secondArgResult, thirdArgResult];

            if (![str, from, to].every((x) => typeof x === 'string' || x instanceof AutomationElement)) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to be string or element'));
            }

            if (str instanceof AutomationElement) {
                return ['' as T];
            }

            if (from instanceof AutomationElement) {
                return [str as T];
            }

            const result = str.split('').map((char) => {
                const index = from.indexOf(char);
                return index !== -1 ? (to instanceof AutomationElement ? '' : to)[index] ?? '' : char;
            }).join('');

            return [result as T];
        }
        case NUMBER:
        case STRING: {
            if (args.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'no more than 1 argument'));
            }

            const [firstArg] = await processArgs(args[0]);

            // @* wildcard may produce multiple values — use the first per XPath string() semantics
            const singleArg = firstArg && firstArg.length > 1 ? [firstArg[0]] : (firstArg ?? [context]);
            return name === STRING ? [...convertProcessedExprNodesToStrings(singleArg) as T[]] : [...convertProcessedExprNodesToNumbers(singleArg) as T[]];
        }
        case SUBSTRING_AFTER:
        case SUBSTRING_BEFORE: {
            if (args.length !== 2) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 2 arguments'));
            }

            const [firstArgResult, secondArgResult] = await processArgs<string | boolean | AutomationElement>(args[0], args[1]);

            if (firstArgResult.length > 1 || secondArgResult.length > 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'each argument to have either one or zero elements'));
            }

            const [lhs] = firstArgResult;
            const [rhs] = secondArgResult;

            if (typeof lhs === 'boolean') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be string, number or element'));
            }

            if (typeof rhs === 'boolean') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the second argument to be string, number or element'));
            }

            const [firstString] = convertProcessedExprNodesToStrings(firstArgResult);
            const [secondString] = convertProcessedExprNodesToStrings(secondArgResult);

            const index = firstString.indexOf(secondString);

            if (index === -1) {
                return ['' as T];
            }

            return name === SUBSTRING_BEFORE ? [firstString.slice(0, index) as T] : [firstString.slice(index + secondString.length) as T];
        }
        case SUBSTRING: {
            if (args.length < 2) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'at least 2 arguments'));
            }

            if (args.length > 3) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'no more than 3 arguments'));
            }

            const [stringArg, fromArg, countArg] = await processArgs(...args);

            if (typeof stringArg[0] === 'boolean' || typeof stringArg[0] === 'number') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the first argument to be string or element'));
            }

            const [string] = convertProcessedExprNodesToStrings(stringArg);
            const [index] = fromArg;
            const count = countArg?.[0];

            if (typeof index !== 'number') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the second argument to be number'));
            }

            if (typeof count !== 'number' && typeof count !== 'undefined') {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'the second argument to be number'));
            }

            // XPath 1.0 spec: positions are 1-indexed, uses round() on start and length
            const start = Math.round(index);
            if (count !== undefined) {
                const end = start + Math.round(count);
                const sliceStart = Math.max(start - 1, 0);
                const sliceEnd = Math.min(end - 1, string.length);
                return [string.slice(sliceStart, Math.max(sliceEnd, sliceStart)) as T];
            } else {
                const sliceStart = Math.max(start - 1, 0);
                return [string.slice(sliceStart) as T];
            }
        }
        case SUM: {
            if (args.length !== 1) {
                throw new errors.InvalidArgumentError(FUNCTION_ARGUMENT_ERROR.format(name, 'exactly 1 argument'));
            }

            const [arg] = await processArgs(args[0]);
            if (!arg || arg.length === 0) return [0 as T];
            const argAsNumbers = convertProcessedExprNodesToNumbers(arg);
            return [argAsNumbers.reduce((a, b) => a + b, 0) as T];
        }
        default:
            throw new errors.InvalidSelectorError(`XPath function ${name}() not found.`);
    }
}

function convertProcessedExprNodesToStrings<T>(...arrayOfProcessedExprNodes: T[]): string[] {
    return arrayOfProcessedExprNodes
        .map((item) => (item instanceof AutomationElement) ? '' : item) // windows element xml representaton never contains text nodes
        .map((item) => item === undefined || item === null ? '' : String(item)); // convert not found elements to empty string and others to string
}

function convertProcessedExprNodesToNumbers<T>(...arrayOfProcessedExprNodes: T[]): number[] {
    const arrayOfStrings = convertProcessedExprNodesToStrings(...arrayOfProcessedExprNodes);
    return arrayOfStrings.map((str) => /^\s*(?<![\d.+-])[+-]?(?:\d*[.])?\d+(?![\d.])\s*$/.test(str) ? Number(str) : NaN);
}