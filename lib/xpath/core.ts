import { Element } from '@appium/types';
import { W3C_ELEMENT_KEY, errors } from '@appium/base-driver';

import XPathAnalyzer, {
    ABSOLUTE_LOCATION_PATH,
    ADDITIVE,
    AND,
    DIVISIONAL,
    EQUALITY,
    ExprNode,
    FILTER,
    FUNCTION_CALL,
    GREATER_THAN,
    GREATER_THAN_OR_EQUAL,
    INEQUALITY,
    LAST,
    LESS_THAN,
    LESS_THAN_OR_EQUAL,
    LITERAL,
    LocationNode,
    MODULUS,
    MULTIPLICATIVE,
    NEGATION,
    NUMBER,
    OR,
    PATH,
    POSITION,
    RELATIVE_LOCATION_PATH,
    SUBTRACTIVE,
    UNION,
    CONTAINS,
    STARTS_WITH,
    StepNode,
    PROCESSING_INSTRUCTION_TEST,
    NodeTestNode,
    NODE_NAME_TEST,
    NODE_TYPE_TEST,
    NODE,
    ANCESTOR,
    ANCESTOR_OR_SELF,
    ATTRIBUTE,
    CHILD,
    DESCENDANT,
    DESCENDANT_OR_SELF,
    FOLLOWING,
    FOLLOWING_SIBLING,
    NAMESPACE,
    PARENT,
    PRECEDING,
    PRECEDING_SIBLING,
    SELF,
    BOOLEAN,
    STRING,
} from 'xpath-analyzer';

import {
    Property,
    PSControlType,
    Condition,
    FalseCondition,
    PropertyCondition,
    TrueCondition,
    AutomationElement,
    FoundAutomationElement,
    AutomationElementGroup,
    TreeScope,
    AndCondition,
    OrCondition,
    NotCondition,
    Int32Property,
    PSInt32,
    PSString,
    StringProperty,
    BooleanProperty,
    PSBoolean,
    PSInt32Array,
    PSOrientationType
} from '../powershell';

import { handleFunctionCall } from './functions';

const OptimizeLastStep = Symbol.for('LastStep');

const XPathAllowedProperties = Object.freeze([
    Property.ACCELERATOR_KEY,
    Property.ACCESS_KEY,
    Property.AUTOMATION_ID,
    Property.CLASS_NAME,
    Property.FRAMEWORK_ID,
    Property.HAS_KEYBOARD_FOCUS,
    Property.HELP_TEXT,
    Property.IS_CONTENT_ELEMENT,
    Property.IS_CONTROL_ELEMENT,
    Property.IS_ENABLED,
    Property.IS_KEYBOARD_FOCUSABLE,
    Property.IS_OFFSCREEN,
    Property.IS_PASSWORD,
    Property.IS_REQUIRED_FOR_FORM,
    Property.ITEM_STATUS,
    Property.ITEM_TYPE,
    Property.LOCALIZED_CONTROL_TYPE,
    Property.NAME,
    Property.ORIENTATION,
    Property.PROCESS_ID,
    Property.RUNTIME_ID,
] as const);

type XPathAllowedProperties = typeof XPathAllowedProperties[number];

const CHILD_OR_SELF = 'child-or-self';

export async function xpathToElIdOrIds(selector: string, mult: boolean, context: string | undefined, sendPowerShellCommand: (command: string) => Promise<string>, includeContextElementInSearch: boolean = false): Promise<Element | Element[]> {
    let parsedXPath: ExprNode;

    try {
        parsedXPath = new XPathAnalyzer(selector).parse();
    } catch (error) {
        if (error instanceof Error) {
            throw new errors.InvalidSelectorError(`Malformed XPath: ${error.message}`);
        } else {
            throw new errors.InvalidSelectorError('Malformed XPath');
        }
    }

    if (!mult) {
        if (parsedXPath.type === UNION) {
            const lhsLastStep = findLastStep(parsedXPath.lhs);
            const rhsLastStep = findLastStep(parsedXPath.rhs);
            if (lhsLastStep) {
                lhsLastStep[lhsLastStep.length - 1][OptimizeLastStep] = true;
            }
            if (rhsLastStep) {
                rhsLastStep[rhsLastStep.length - 1][OptimizeLastStep] = true;
            }
        } else {
            const lastStep = findLastStep(parsedXPath);
            if (lastStep && lastStep[lastStep.length - 1].predicates.every(predicateProcessableBeforeNode)) {
                lastStep[lastStep.length - 1][OptimizeLastStep] = true;
            }
        }
    }

    if (parsedXPath.type === 'absolute-location-path' && parsedXPath.steps[0].axis === CHILD) {
        parsedXPath.steps[0].axis = CHILD_OR_SELF as any;
    }

    const executor = new XPathExecutor(context ? new FoundAutomationElement(context) : AutomationElement.automationRoot, sendPowerShellCommand, includeContextElementInSearch);
    const foundElements = await executor.processExprNode<FoundAutomationElement>(parsedXPath);
    const els = foundElements.filter((el) => el instanceof FoundAutomationElement).map((el) => ({ [W3C_ELEMENT_KEY]: el.runtimeId }));

    if (mult) {
        return els;
    }

    if (els.length === 0) {
        throw new errors.NoSuchElementError();
    }

    return els[0];
}

export class XPathExecutor {
    constructor(
        public context: AutomationElement,
        public sendPowerShellCommand: (command: string) => Promise<string>,
        public includeContextElementInSearch: boolean = false,
        public contextState: [number, number] | undefined = undefined
    ) { }

    public async processExprNode<T>(exprNode: ExprNode, context: AutomationElement = this.context, contextState: [number, number] | undefined = this.contextState): Promise<T[]> {
        switch (exprNode.type) {
            case NUMBER:
                return [exprNode.number as T];
            case LITERAL:
                return [exprNode.string as T];
            case UNION:
                return [...await this.processExprNode<T>(exprNode.lhs, context, contextState), ...await this.processExprNode<T>(exprNode.rhs, context, contextState)];
            case FUNCTION_CALL:
                return await handleFunctionCall(exprNode.name, context, this, contextState, ...exprNode.args);
            case ABSOLUTE_LOCATION_PATH:
            case RELATIVE_LOCATION_PATH: {
                const result: T[][] = [];
                for (const element of convertToElementArray(context)) {
                    result.push(await this.handleLocationNode(exprNode, element) as T[]);
                }

                return result.flat();
            }
            case PATH: {
                const filterResult = await this.processExprNode<T>(exprNode.filter, context, contextState);
                const result: T[][] = [];
                for (const item of filterResult) {
                    if (item instanceof AutomationElement) {
                        const itemAfterSteps = await this.handleLocationNode({
                            type: RELATIVE_LOCATION_PATH,
                            steps: exprNode.steps,
                        }, item);
                        result.push(itemAfterSteps as T[]);
                    }
                }

                return result.flat();
            }
            case FILTER: {
                const result: T[] = [];
                const exprResult = await this.processExprNode<T>(exprNode.primary, context, contextState);
                for (const item of exprResult) {
                    if (item instanceof AutomationElement) {
                        const filteredItem = await this.executeStep({
                            axis: SELF,
                            test: {
                                type: NODE_TYPE_TEST,
                                name: NODE,
                            },
                            predicates: exprNode.predicates,
                        }, item) as T;
                        result.push(filteredItem);
                    }
                }

                return result;
            }
            case OR:
            case AND: {
                const [lhs] = await handleFunctionCall<T>(BOOLEAN, context, this, contextState, exprNode.lhs);
                const [rhs] = await handleFunctionCall<T>(BOOLEAN, context, this, contextState, exprNode.rhs);

                if (exprNode.type === AND) {
                    return [lhs && rhs];
                } else {
                    return [lhs || rhs];
                }
            }
            case NEGATION:
                return [-await handleFunctionCall<T>(NUMBER, context, this, contextState, exprNode.lhs) as T];
            case EQUALITY:
            case INEQUALITY: {
                const [lhs] = await handleFunctionCall<string>(STRING, context, this, contextState, exprNode.lhs);
                const [rhs] = await handleFunctionCall<string>(STRING, context, this, contextState, exprNode.rhs);
                if (isNaN(Number(lhs)) || isNaN(Number(rhs))) {
                    return [exprNode.type === EQUALITY ? (lhs === rhs) as T : (lhs !== rhs) as T];
                }

                return [exprNode.type === EQUALITY ? (Number(lhs) === Number(rhs)) as T : (Number(lhs) !== Number(rhs)) as T];
            }
            case ADDITIVE:
            case DIVISIONAL:
            case GREATER_THAN:
            case GREATER_THAN_OR_EQUAL:
            case LESS_THAN:
            case LESS_THAN_OR_EQUAL:
            case MODULUS:
            case MULTIPLICATIVE:
            case SUBTRACTIVE:
                {
                    const [lhs] = await handleFunctionCall<number>(NUMBER, context, this, contextState, exprNode.lhs);
                    const [rhs] = await handleFunctionCall<number>(NUMBER, context, this, contextState, exprNode.rhs);

                    switch (exprNode.type) {
                        case ADDITIVE:
                            return [(lhs + rhs) as T];
                        case DIVISIONAL:
                            return [(lhs / rhs) as T];
                        case GREATER_THAN:
                            return [(lhs > rhs) as T];
                        case GREATER_THAN_OR_EQUAL:
                            return [(lhs >= rhs) as T];
                        case LESS_THAN:
                            return [(lhs < rhs) as T];
                        case LESS_THAN_OR_EQUAL:
                            return [(lhs <= rhs) as T];
                        case MODULUS:
                            return [(lhs % rhs) as T];
                        case MULTIPLICATIVE:
                            return [(lhs * rhs) as T];
                        case SUBTRACTIVE:
                            return [(lhs - rhs) as T];
                    }
                }
        }
    }

    private async handleLocationNode(location: LocationNode, context: AutomationElement): Promise<AutomationElement[] | string[]> {
        if (location.steps.some((step) => step.test.name === null)) {
            throw new errors.InvalidSelectorError('Expected path step expression.');
        }

        if (location.type === ABSOLUTE_LOCATION_PATH) {
            context = AutomationElement.automationRoot;
        }

        if (context instanceof AutomationElementGroup && context.groups.length > 1) {
            throw new errors.InvalidArgumentError(`handleLocationNode expects single context, but received ${context.groups.length} contexts.`);
        }

        optimizeDoubleSlash(location.steps, this.includeContextElementInSearch);

        for (const [index, step] of location.steps.entries()) {
            if (step.axis === ATTRIBUTE) {
                if (index === location.steps.length - 1) {
                    return await convertAttributeNodeTestToStringArray(step.test, context, this.sendPowerShellCommand);
                } else {
                    return [];
                }
            }

            if (context instanceof AutomationElementGroup) {
                const results: AutomationElementGroup[] = [];
                for (const el of context.groups) {
                    results.push(await this.executeStep(step, el));
                }
                context = new AutomationElementGroup(...flattenElementGroupsAndRemoveDuplicates(results));
            } else {
                context = await this.executeStep(step, context);
            }
        }

        return convertToElementArray(context);
    }

    private async processExprNodeAsPredicate(exprNode: ExprNode, context: AutomationElement, positions: Set<number>, relativeExprNodes?: ExprNode[]): Promise<[Condition, ExprNode[]?]> {
        relativeExprNodes ??= [];
        switch (exprNode.type) {
            case ADDITIVE:
            case SUBTRACTIVE:
            case MULTIPLICATIVE:
            case DIVISIONAL:
            case MODULUS:
            case NUMBER:
                return await this.processExprNodeAsPredicate({
                    type: EQUALITY,
                    lhs: {
                        type: FUNCTION_CALL,
                        name: POSITION,
                        args: [],
                    },
                    rhs: exprNode
                }, context, positions, relativeExprNodes);
            case OR: {
                // Use fresh arrays so relativeExprNodes from each side don't leak into the shared array.
                // If either side has JS-level filters, the entire OR must be evaluated as one unit in JS.
                const orLhsRel: ExprNode[] = [];
                const orRhsRel: ExprNode[] = [];
                const [orLhsCond] = await this.processExprNodeAsPredicate(exprNode.lhs, context, positions, orLhsRel);
                const [orRhsCond] = await this.processExprNodeAsPredicate(exprNode.rhs, context, positions, orRhsRel);
                if (orLhsRel.length > 0 || orRhsRel.length > 0) {
                    relativeExprNodes.push(exprNode);
                    return [new TrueCondition(), relativeExprNodes];
                }
                return [new OrCondition(orLhsCond, orRhsCond), relativeExprNodes];
            }
            case AND:
                return [new AndCondition(
                    (await this.processExprNodeAsPredicate(exprNode.lhs, context, positions, relativeExprNodes))[0],
                    (await this.processExprNodeAsPredicate(exprNode.rhs, context, positions, relativeExprNodes))[0]
                ), relativeExprNodes];
            case EQUALITY:
            case INEQUALITY:
            case GREATER_THAN:
            case GREATER_THAN_OR_EQUAL:
            case LESS_THAN:
            case LESS_THAN_OR_EQUAL: {
                if ((exprNode.lhs.type === RELATIVE_LOCATION_PATH) !== (exprNode.rhs.type === RELATIVE_LOCATION_PATH)) {
                    // Handle @* = 'value' or @* != 'value' — match/exclude any string property (XPath wildcard attribute)
                    if ((exprNode.type === EQUALITY || exprNode.type === INEQUALITY)
                        && exprNode.lhs.type === RELATIVE_LOCATION_PATH
                        && exprNode.lhs.steps.length === 1
                        && exprNode.lhs.steps[0].axis === ATTRIBUTE
                        && exprNode.lhs.steps[0].test.type === NODE_NAME_TEST
                        && exprNode.lhs.steps[0].test.name === '*'
                    ) {
                        const [value] = await this.processExprNode(exprNode.rhs, context, undefined);
                        const stringValue = String(value);
                        const conditions = Object.values(StringProperty).map(prop => new PropertyCondition(prop, new PSString(stringValue)));
                        const orCondition = new OrCondition(...conditions);
                        return [exprNode.type === EQUALITY ? orCondition : new NotCondition(orCondition), relativeExprNodes];
                    }

                    // Handle 'value' = @* or 'value' != @* — same but reversed
                    if ((exprNode.type === EQUALITY || exprNode.type === INEQUALITY)
                        && exprNode.rhs.type === RELATIVE_LOCATION_PATH
                        && exprNode.rhs.steps.length === 1
                        && exprNode.rhs.steps[0].axis === ATTRIBUTE
                        && exprNode.rhs.steps[0].test.type === NODE_NAME_TEST
                        && exprNode.rhs.steps[0].test.name === '*'
                    ) {
                        const [value] = await this.processExprNode(exprNode.lhs, context, undefined);
                        const stringValue = String(value);
                        const conditions = Object.values(StringProperty).map(prop => new PropertyCondition(prop, new PSString(stringValue)));
                        const orCondition = new OrCondition(...conditions);
                        return [exprNode.type === EQUALITY ? orCondition : new NotCondition(orCondition), relativeExprNodes];
                    }

                    if (exprNode.lhs.type === RELATIVE_LOCATION_PATH
                        && exprNode.lhs.steps[0].axis === ATTRIBUTE
                        && exprNode.lhs.steps[0].test.type === NODE_NAME_TEST
                        && XPathAllowedProperties.includes(exprNode.lhs.steps[0].test.name?.toLowerCase() as XPathAllowedProperties)
                    ) {
                        const propertyName = exprNode.lhs.steps[0].test.name?.toLowerCase() as Property;
                        const [value] = await this.processExprNode(exprNode.rhs, context, undefined);
                        let cond: Condition | undefined;
                        if (propertyName === Property.RUNTIME_ID) {
                            cond = new PropertyCondition(propertyName, new PSInt32Array(String(value).split('.').map(Number)));
                        } else if (propertyName === Property.ORIENTATION) {
                            cond = new PropertyCondition(propertyName, new PSOrientationType(String(value)));
                        } else if (Object.values(Int32Property).includes(propertyName as Int32Property)) {
                            cond = new PropertyCondition(propertyName, new PSInt32(Number(value)));
                        } else if (Object.values(StringProperty).includes(propertyName as StringProperty)) {
                            cond = new PropertyCondition(propertyName, new PSString(String(value)));
                        } else if (Object.values(BooleanProperty).includes(propertyName as BooleanProperty)) {
                            cond = new PropertyCondition(propertyName, new PSBoolean(Boolean(value)));
                        }
                        if (cond) {
                            return [exprNode.type === INEQUALITY ? new NotCondition(cond) : cond, relativeExprNodes];
                        }
                    }

                    if (exprNode.rhs.type === RELATIVE_LOCATION_PATH
                        && exprNode.rhs.steps[0].axis === ATTRIBUTE
                        && exprNode.rhs.steps[0].test.type === NODE_NAME_TEST
                        && XPathAllowedProperties.includes(exprNode.rhs.steps[0].test.name?.toLowerCase() as XPathAllowedProperties)
                    ) {
                        const propertyName = exprNode.rhs.steps[0].test.name?.toLowerCase() as Property;
                        const [value] = await this.processExprNode(exprNode.lhs, context, undefined);
                        let cond: Condition | undefined;
                        if (propertyName === Property.RUNTIME_ID) {
                            cond = new PropertyCondition(propertyName, new PSInt32Array(String(value).split('.').map(Number)));
                        } else if (propertyName === Property.ORIENTATION) {
                            cond = new PropertyCondition(propertyName, new PSOrientationType(String(value)));
                        } else if (Object.values(Int32Property).includes(propertyName as Int32Property)) {
                            cond = new PropertyCondition(propertyName, new PSInt32(Number(value)));
                        } else if (Object.values(StringProperty).includes(propertyName as StringProperty)) {
                            cond = new PropertyCondition(propertyName, new PSString(String(value)));
                        } else if (Object.values(BooleanProperty).includes(propertyName as BooleanProperty)) {
                            cond = new PropertyCondition(propertyName, new PSBoolean(Boolean(value)));
                        }
                        if (cond) {
                            return [exprNode.type === INEQUALITY ? new NotCondition(cond) : cond, relativeExprNodes];
                        }
                    }
                } else if ((exprNode.lhs.type === FUNCTION_CALL && exprNode.lhs.name === POSITION) !== (exprNode.rhs.type === FUNCTION_CALL && exprNode.rhs.name === POSITION)) {
                    const positionNode = exprNode.lhs.type === FUNCTION_CALL && exprNode.lhs.name === POSITION ? exprNode.lhs : exprNode.rhs;
                    const otherNode = positionNode === exprNode.lhs ? exprNode.rhs : exprNode.lhs;

                    if (otherNode.type === FUNCTION_CALL && otherNode.name === LAST) {
                        if (exprNode.type === EQUALITY) {
                            positions.add(0x7FFFFFFF);
                            return [new TrueCondition()];
                        }
                    } else if (otherNode.type === NUMBER) {
                        const [value] = await this.processExprNode<number>(otherNode, context, undefined);
                        if (typeof value === 'number' && exprNode.type === EQUALITY) {
                            positions.add(value);
                            return [new TrueCondition()];
                        }
                    }
                }

                relativeExprNodes.push(exprNode);
                return [new TrueCondition(), relativeExprNodes];
            }
            case FUNCTION_CALL:
                if (exprNode.name === LAST) {
                    return await this.processExprNodeAsPredicate({
                        type: EQUALITY,
                        lhs: {
                            type: FUNCTION_CALL,
                            name: POSITION,
                            args: [],
                        },
                        rhs: exprNode
                    }, context, positions, relativeExprNodes);
                }
            // eslint-disable-next-line no-fallthrough
            case RELATIVE_LOCATION_PATH: {
                if (exprNode.type === RELATIVE_LOCATION_PATH) {
                    const locNode = exprNode as LocationNode;
                    if (locNode.steps.length === 1
                        && locNode.steps[0].axis === ATTRIBUTE
                        && locNode.steps[0].test.type === NODE_NAME_TEST
                        && locNode.steps[0].test.name === '*'
                    ) {
                        return [new TrueCondition(), relativeExprNodes];
                    }
                }
            }
            // eslint-disable-next-line no-fallthrough
            default: {
                const result = await this.processExprNode(exprNode, context, undefined);

                if (result.length === 1 && typeof result[0] === 'number' && !isNaN(result[0])) {
                    return await this.processExprNodeAsPredicate({
                        type: EQUALITY,
                        lhs: {
                            type: FUNCTION_CALL,
                            name: POSITION,
                            args: [],
                        },
                        rhs: {
                            type: NUMBER,
                            number: result[0],
                        }
                    }, context, positions, relativeExprNodes);
                }

                relativeExprNodes.push(exprNode);
                return [new TrueCondition(), relativeExprNodes];
            }
        }
    }

    private async executeStep(step: StepNode, context: AutomationElement): Promise<AutomationElementGroup> {
        // XPath predicate ordering: predicates are applied left-to-right in sequence.
        // Predicates before the first positional predicate filter the full set.
        // Predicates after a positional predicate are applied to the position-filtered result.
        // Example: Text[6][contains(@Name,'x')] → pick 6th Text, then test contains.
        //          Text[contains(@Name,'x')][6] → filter by contains, then pick 6th.
        const prePositionConditions: Condition[] = [];
        const prePositionRelativeExprs: ExprNode[] = [];
        const postPositionRelativeExprs: ExprNode[] = [];
        const positions: Set<number> = new Set();
        let seenPosition = false;
        for (const predicate of step.predicates) {
            const sizeBeforeAdd = positions.size;
            const [condition, exprNodes] = await this.processExprNodeAsPredicate(predicate, context, positions);
            const addedPosition = positions.size > sizeBeforeAdd;
            if (addedPosition) {
                seenPosition = true;
                prePositionConditions.push(condition);
            } else if (!seenPosition) {
                prePositionConditions.push(condition);
                if (exprNodes) prePositionRelativeExprs.push(...exprNodes);
            } else {
                // This predicate follows a positional predicate — must apply after position filtering
                if (exprNodes) postPositionRelativeExprs.push(...exprNodes);
            }
        }

        const condition = prePositionConditions.length > 0 ? new AndCondition(convertNodeTestToCondition(step.test), ...prePositionConditions) : convertNodeTestToCondition(step.test);

        let find: AutomationElement;
        switch (step.axis) {
            case ANCESTOR:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.ANCESTORS, condition) : context.findAll(TreeScope.ANCESTORS, condition);
                break;
            case ANCESTOR_OR_SELF:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.ANCESTORS_OR_SELF, condition) : context.findAll(TreeScope.ANCESTORS_OR_SELF, condition);
                break;
            case CHILD:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.CHILDREN, condition) : context.findAll(TreeScope.CHILDREN, condition);
                break;
            case CHILD_OR_SELF as any:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.CHILDREN_OR_SELF, condition) : context.findAll(TreeScope.CHILDREN_OR_SELF, condition);
                break;
            case DESCENDANT:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.DESCENDANTS, condition) : context.findAll(TreeScope.DESCENDANTS, condition);
                break;
            case DESCENDANT_OR_SELF:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.SUBTREE, condition) : context.findAll(TreeScope.SUBTREE, condition);
                break;
            case FOLLOWING:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.FOLLOWING, condition) : context.findAll(TreeScope.FOLLOWING, condition);
                break;
            case FOLLOWING_SIBLING:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.FOLLOWING_SIBLING, condition) : context.findAll(TreeScope.FOLLOWING_SIBLING, condition);
                break;
            case NAMESPACE:
                return new AutomationElementGroup(/* empty */);
            case PARENT:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.PARENT, condition) : context.findAll(TreeScope.PARENT, condition);
                break;
            case PRECEDING:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.PRECEDING, condition) : context.findAll(TreeScope.PRECEDING, condition);
                break;
            case PRECEDING_SIBLING:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.PRECEDING_SIBLING, condition) : context.findAll(TreeScope.PRECEDING_SIBLING, condition);
                break;
            case SELF:
                find = step[OptimizeLastStep] ? context.findFirst(TreeScope.ELEMENT, condition) : context.findAll(TreeScope.ELEMENT, condition);
                break;
            default:
                throw new errors.InvalidArgumentError(); // should not be reached, attribute is handled before that
        }

        const validEls: FoundAutomationElement[] = [];

        // Optimization: Try to offload simple functional filters (contains, starts-with) to PowerShell.
        // Only pre-position predicates can use this optimization — post-position predicates must wait.
        const remainingExprNodes: ExprNode[] = [];
        for (const exprNode of prePositionRelativeExprs) {
            const psFilter = convertExprNodeToPowerShellFilter(exprNode);
            if (psFilter) {
                find.setPsFilter(psFilter);
            } else {
                remainingExprNodes.push(exprNode);
            }
        }

        const result = await this.sendPowerShellCommand(find.buildCommand());
        const els = result.split('\n').map((id) => id.trim()).filter(Boolean).map((id) => new FoundAutomationElement(id));

        for (const [index, el] of els.entries()) {
            let isValid = true;
            for (const exprNode of remainingExprNodes) {
                const [isTrue] = await handleFunctionCall(BOOLEAN, el, this, [index + 1, els.length], exprNode);
                if (!isTrue) {
                    isValid = false;
                    break;
                }
            }

            if (isValid) {
                validEls.push(el);
            }
        }

        const positionsArray = Array.from(positions);
        const positionFilteredEls = positionsArray.length === 0
            ? validEls
            : positionsArray.map((index) => index === 0x7FFFFFFF ? validEls[validEls.length - 1] : validEls[index - 1]).filter(Boolean);

        if (postPositionRelativeExprs.length === 0) {
            return new AutomationElementGroup(...positionFilteredEls);
        }

        // Apply predicates that follow the positional predicate, evaluated on position-filtered elements
        const finalEls: FoundAutomationElement[] = [];
        for (const [index, el] of positionFilteredEls.entries()) {
            let isValid = true;
            for (const exprNode of postPositionRelativeExprs) {
                const [isTrue] = await handleFunctionCall(BOOLEAN, el, this, [index + 1, positionFilteredEls.length], exprNode);
                if (!isTrue) {
                    isValid = false;
                    break;
                }
            }
            if (isValid) finalEls.push(el);
        }
        return new AutomationElementGroup(...finalEls);
    }
}

function convertNodeTestToCondition(nodeTest: NodeTestNode): Condition {
    switch (nodeTest.type) {
        case NODE_NAME_TEST:
            if (nodeTest.name === '*') {
                return new TrueCondition();
            }
            // workaround for ControlType 50039 and 50040 not supported in UIAutomationClient
            if (nodeTest.name.toLowerCase() === 'appbar' || nodeTest.name.toLowerCase() === 'semanticzoom') {
                // PSControlType already has a logic to correct the value to localized control type
                return new PropertyCondition(Property.LOCALIZED_CONTROL_TYPE, new PSString(new PSControlType(nodeTest.name).toString()));
            }

            if (nodeTest.name.toLowerCase() === 'list') {
                return new OrCondition(
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('List')),
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataGrid'))
                );
            }

            if (nodeTest.name.toLowerCase() === 'listitem') {
                return new OrCondition(
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('ListItem')),
                    new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataItem'))
                );
            }

            return new PropertyCondition(Property.CONTROL_TYPE, new PSControlType(nodeTest.name));
        case NODE_TYPE_TEST:
            if (nodeTest.name === NODE) {
                return new TrueCondition();
            }
        // eslint-disable-next-line no-fallthrough
        case PROCESSING_INSTRUCTION_TEST:
            return new FalseCondition();
    }
}

async function convertAttributeNodeTestToStringArray(nodeTest: NodeTestNode, context: AutomationElement, sendPowerShellCommand: (command: string) => Promise<string>): Promise<string[]> {
    const result = await sendPowerShellCommand(context.buildGetPropertyCommand(Property.RUNTIME_ID));
    const els = result.split('\n').map((id) => id.trim()).filter(Boolean).map((id) => new FoundAutomationElement(id.trim()));
    const extraProperties = ['x', 'y', 'width', 'height'];
    switch (nodeTest.type) {
        case NODE_TYPE_TEST:
            if (nodeTest.name === NODE) {
                const results: string[] = [];
                for (const name of Object.values(Property)) {
                    for (const el of els) {
                        results.push(await sendPowerShellCommand(el.buildGetPropertyCommand(name)));
                    }
                }

                return results;
            }

            return [];
        case NODE_NAME_TEST:
            if (nodeTest.name === '*') {
                // @* wildcard — return all string property values for use in post-filter conditions
                const results: string[] = [];
                for (const el of els) {
                    for (const prop of Object.values(StringProperty)) {
                        const val = await sendPowerShellCommand(el.buildGetPropertyCommand(prop));
                        if (val && val.trim()) results.push(val.trim());
                    }
                }
                return results;
            }

            if (extraProperties.includes(nodeTest.name.toLowerCase())) {
                const results: string[] = [];
                for (const el of els) {
                    const rectJson = await sendPowerShellCommand(el.buildGetElementRectCommand());
                    results.push(JSON.parse(rectJson.replaceAll(/(?:infinity)/gi, 0x7FFFFFFF.toString()))[nodeTest.name.toLowerCase()]);
                }

                return results;
            }

            if (Object.values(Property).includes(nodeTest.name.toLowerCase() as Property)) {
                const results: string[] = [];
                for (const el of els) {
                    results.push(await sendPowerShellCommand(el.buildGetPropertyCommand(nodeTest.name)));
                }

                return results;
            }
        // eslint-disable-next-line no-fallthrough
        case PROCESSING_INSTRUCTION_TEST:
        default:
            return [];
    }
}

function convertToElementArray(element: AutomationElement): AutomationElement[] {
    if (element instanceof AutomationElementGroup) {
        return flattenElementGroupsAndRemoveDuplicates(element.groups);
    }

    return [element];
}

function flattenElementGroupsAndRemoveDuplicates(elements: AutomationElement[]): AutomationElement[] {
    const seen = new Set<string>();
    return elements.reduce<AutomationElement[]>((acc, el) => {
        if (el instanceof AutomationElementGroup) {
            return acc.concat(flattenElementGroupsAndRemoveDuplicates(el.groups));
        } else {
            if (el instanceof FoundAutomationElement && seen.has(el.runtimeId)) {
                return acc;
            }

            if (el instanceof FoundAutomationElement) {
                seen.add(el.runtimeId);
            }

            acc.push(el);
            return acc;
        }
    }, []);
}

function optimizeDoubleSlash(steps: StepNode[], includeContextElementInSearch: boolean): void {
    for (let i = 0; i < steps.length - 1; i++) {
        // detect double slash: //element is the same as /descendant-or-self::node()/child::element
        if (steps[i].axis === DESCENDANT_OR_SELF && steps[i].test.type === NODE_TYPE_TEST && steps[i].predicates.length === 0 && steps[i + 1].axis === CHILD) {
            const includeSelf = steps.slice(0, i).every((step) => step.axis === SELF && step.test.type === NODE_TYPE_TEST && step.test.name === NODE) && includeContextElementInSearch;
            const optimizedStep: StepNode = { axis: includeSelf ? DESCENDANT_OR_SELF : DESCENDANT, test: steps[i + 1].test, predicates: steps[i + 1].predicates };
            if (steps[i + 1][OptimizeLastStep]) {
                optimizedStep[OptimizeLastStep] = true;
            }
            const stepsToAdd: StepNode[] = [optimizedStep];
            if (steps[i].predicates.some((predicate) => predicate.type === FUNCTION_CALL && (predicate.name === LAST || predicate.name === POSITION))) {
                stepsToAdd.push({ axis: PARENT, test: { type: NODE_TYPE_TEST, name: 'node' }, predicates: [] }, steps[i + 1]);
            }

            // mutates the original array by reference
            steps.splice(i, 2, ...stepsToAdd);
        }
    }
}

function findLastStep(obj: object): StepNode[] | undefined {
    if (Array.isArray(obj)) {
        return findLastStep(obj[obj.length - 1]);
    }

    let lastStepArray: StepNode[] | undefined;
    for (const key in obj) {
        if (key === 'steps' && Array.isArray(obj[key])) {
            lastStepArray = obj[key];
        }
        if (typeof obj[key] === 'object') {
            const result = findLastStep(obj[key]);

            if (result !== undefined) {
                lastStepArray = result;
            }
        }
    }

    return lastStepArray;
}

export function predicateProcessableBeforeNode(exprNode: ExprNode): boolean {
    switch (exprNode.type) {
        case OR:
        case AND:
            return predicateProcessableBeforeNode(exprNode.lhs) && predicateProcessableBeforeNode(exprNode.rhs);
        case EQUALITY:
        case INEQUALITY: {
            if ((exprNode.lhs.type === RELATIVE_LOCATION_PATH) !== (exprNode.rhs.type === RELATIVE_LOCATION_PATH)) {
                if (exprNode.lhs.type === RELATIVE_LOCATION_PATH
                    && exprNode.lhs.steps[0].axis === ATTRIBUTE
                    && exprNode.lhs.steps[0].test.type === NODE_NAME_TEST
                ) {
                    if (exprNode.lhs.steps[0].test.name === '*'
                        || XPathAllowedProperties.includes(exprNode.lhs.steps[0].test.name?.toLowerCase() as XPathAllowedProperties)
                    ) {
                        return true;
                    }
                }

                if (exprNode.rhs.type === RELATIVE_LOCATION_PATH
                    && exprNode.rhs.steps[0].axis === ATTRIBUTE
                    && exprNode.rhs.steps[0].test.type === NODE_NAME_TEST
                ) {
                    if (exprNode.rhs.steps[0].test.name === '*'
                        || XPathAllowedProperties.includes(exprNode.rhs.steps[0].test.name?.toLowerCase() as XPathAllowedProperties)
                    ) {
                        return true;
                    }
                }
            }
        }
        // eslint-disable-next-line no-fallthrough
        default: {
            return false;
        }
    }
}

function convertExprNodeToPowerShellFilter(exprNode: ExprNode): string | undefined {
    if (exprNode.type === FUNCTION_CALL && (exprNode.name === CONTAINS || exprNode.name === STARTS_WITH)) {
        if (exprNode.args.length !== 2) return undefined;

        const lhs = exprNode.args[0];
        const rhs = exprNode.args[1];

        // Optimize simple property checks: contains(@Name, 'foo')
        if (lhs.type === RELATIVE_LOCATION_PATH && lhs.steps.length === 1 && lhs.steps[0].axis === ATTRIBUTE && rhs.type === LITERAL) {
            const propName = lhs.steps[0].test.name;
            const psAccessor = AutomationElement.getPropertyAccessor(propName || '');
            if (!psAccessor) return undefined;

            const value = (rhs as any).value || (rhs as any).string || '';
            // Escape single quotes for PowerShell
            const escapedValue = String(value).replace(/'/g, "''");

            if (exprNode.name === CONTAINS) {
                return `${psAccessor} -like '*${escapedValue}*'`;
            } else {
                return `${psAccessor} -like '${escapedValue}*'`;
            }
        }
    }
    return undefined;
}
