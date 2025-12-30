import { errors } from '@appium/base-driver';
const XPathAnalyzer = require('xpath-analyzer').default;
import {
    ABSOLUTE_LOCATION_PATH,
    RELATIVE_LOCATION_PATH,
    UNION,
    PATH,
    FILTER,
    NODE_NAME_TEST,
    NODE_TYPE_TEST,
    CHILD,
    DESCENDANT,
    DESCENDANT_OR_SELF,
    ATTRIBUTE,
    SELF,
    PARENT,
    EQUALITY,
    INEQUALITY,
    LITERAL,
    NUMBER,
    FUNCTION_CALL,
    POSITION,
    LAST,
    AND,
    OR,
    NODE
} from 'xpath-analyzer';
import { UIAClient, UIAElement, TreeScope } from '../winapi/uia';
import * as UIA from '../winapi/uia';

const CONTROL_TYPE_MAP: Record<string, number> = {
    'button': UIA.UIA_ButtonControlTypeId,
    'calendar': UIA.UIA_CalendarControlTypeId,
    'checkbox': UIA.UIA_CheckBoxControlTypeId,
    'combobox': UIA.UIA_ComboBoxControlTypeId,
    'edit': UIA.UIA_EditControlTypeId,
    'hyperlink': UIA.UIA_HyperlinkControlTypeId,
    'image': UIA.UIA_ImageControlTypeId,
    'listitem': UIA.UIA_ListItemControlTypeId,
    'list': UIA.UIA_ListControlTypeId,
    'menu': UIA.UIA_MenuControlTypeId,
    'menubar': UIA.UIA_MenuBarControlTypeId,
    'menuitem': UIA.UIA_MenuItemControlTypeId,
    'progressbar': UIA.UIA_ProgressBarControlTypeId,
    'radiobutton': UIA.UIA_RadioButtonControlTypeId,
    'scrollbar': UIA.UIA_ScrollBarControlTypeId,
    'slider': UIA.UIA_SliderControlTypeId,
    'spinner': UIA.UIA_SpinnerControlTypeId,
    'statusbar': UIA.UIA_StatusBarControlTypeId,
    'tab': UIA.UIA_TabControlTypeId,
    'tabitem': UIA.UIA_TabItemControlTypeId,
    'text': UIA.UIA_TextControlTypeId,
    'toolbar': UIA.UIA_ToolBarControlTypeId,
    'tooltip': UIA.UIA_ToolTipControlTypeId,
    'tree': UIA.UIA_TreeControlTypeId,
    'treeitem': UIA.UIA_TreeItemControlTypeId,
    'group': UIA.UIA_GroupControlTypeId,
    'thumb': UIA.UIA_ThumbControlTypeId,
    'datagrid': UIA.UIA_DataGridControlTypeId,
    'dataitem': UIA.UIA_DataItemControlTypeId,
    'document': UIA.UIA_DocumentControlTypeId,
    'splitbutton': UIA.UIA_SplitButtonControlTypeId,
    'window': UIA.UIA_WindowControlTypeId,
    'pane': UIA.UIA_PaneControlTypeId,
    'header': UIA.UIA_HeaderControlTypeId,
    'headeritem': UIA.UIA_HeaderItemControlTypeId,
    'table': UIA.UIA_TableControlTypeId,
    'titlebar': UIA.UIA_TitleBarControlTypeId,
    'separator': UIA.UIA_SeparatorControlTypeId,
    'semanticzoom': UIA.UIA_SemanticZoomControlTypeId,
    'appbar': UIA.UIA_AppBarControlTypeId,
};

const PROPERTY_MAP: Record<string, number> = {
    'name': UIA.UIA_NamePropertyId,
    'automationid': UIA.UIA_AutomationIdPropertyId,
    'classname': UIA.UIA_ClassNamePropertyId,
    'controltype': UIA.UIA_ControlTypePropertyId,
    'localizedcontroltype': UIA.UIA_LocalizedControlTypePropertyId,
    'isenabled': UIA.UIA_IsEnabledPropertyId,
    'isoffscreen': UIA.UIA_IsOffscreenPropertyId,
    'frameworkid': UIA.UIA_FrameworkIdPropertyId,
};

export class NativeXPathEngine {
    private client: UIAClient;

    constructor(client: UIAClient) {
        this.client = client;
    }

    public async findElements(selector: string, contextElement?: UIAElement): Promise<UIAElement[]> {
        let ast: any;
        try {
            ast = new XPathAnalyzer(selector).parse();
        } catch (e: any) {
            throw new errors.InvalidSelectorError(`Malformed XPath: ${e.message}`);
        }

        const root = contextElement || this.client.getRootElement();
        return await this.evaluate(ast, [root]);
    }

    private async evaluate(node: any, contexts: UIAElement[]): Promise<UIAElement[]> {
        switch (node.type) {
            case UNION:
                const lhs = await this.evaluate(node.lhs, contexts);
                const rhs = await this.evaluate(node.rhs, contexts);
                return this.unique(lhs.concat(rhs));

            case ABSOLUTE_LOCATION_PATH:
                const desktopRoot = this.client.getRootElement();
                return await this.evaluateSteps(node.steps, [desktopRoot]);

            case RELATIVE_LOCATION_PATH:
                return await this.evaluateSteps(node.steps, contexts);

            default:
                throw new Error(`Unsupported XPath node type: ${node.type}`);
        }
    }

    private async evaluateSteps(steps: any[], initialContexts: UIAElement[]): Promise<UIAElement[]> {
        // Simple optimization: if first step is descendant-or-self::node() and second is child::tag,
        // merge them into descendant::tag for better performance.
        const optimizedSteps = [...steps];
        for (let i = 0; i < optimizedSteps.length - 1; i++) {
            const current = optimizedSteps[i];
            const next = optimizedSteps[i + 1];
            if (current.axis === 'descendant-or-self' &&
                current.test.type === 'nodeTypeTest' && current.test.name === 'node' &&
                current.predicates.length === 0 &&
                next.axis === 'child') {

                optimizedSteps.splice(i, 2, {
                    axis: 'descendant',
                    test: next.test,
                    predicates: next.predicates
                });
            }
        }

        let currentContexts = initialContexts;

        for (const step of optimizedSteps) {
            let nextContexts: UIAElement[] = [];

            for (const context of currentContexts) {
                const stepResults = await this.evaluateStep(step, context);
                nextContexts = nextContexts.concat(stepResults);
            }

            currentContexts = this.unique(nextContexts);
            if (currentContexts.length === 0) break;
        }

        return currentContexts;
    }


    private async evaluateStep(step: any, context: UIAElement): Promise<UIAElement[]> {
        const { axis, test, predicates } = step;
        const axisStr = String(axis);
        let scope: number;

        switch (axisStr) {
            case 'child':
                scope = TreeScope.Children;
                break;
            case 'descendant':
            case 'descendant-or-self':
                scope = TreeScope.Descendants;
                break;
            case 'self':
                scope = TreeScope.Element;
                break;
            case 'parent':
                scope = TreeScope.Parent;
                break;
            case 'ancestor':
            case 'ancestor-or-self':
                scope = TreeScope.Ancestors;
                break;
            default:
                throw new Error(`Unsupported XPath axis: ${axisStr}`);
        }

        let condition: any;
        try {
            // Use RawViewCondition as the most reliable base condition
            condition = this.client.getRawViewCondition();
        } catch (e) {
            // Fallback to TrueCondition if getRawViewCondition fails
            condition = this.client.createTrueCondition();
        }

        let results: UIAElement[] = [];
        const found = context.findAll(scope, condition);
        if (found) {
            results = found.toArray();
        }

        // Handle self-matching for appropriate axes
        if (axisStr === 'descendant-or-self' || axisStr === 'self' || axisStr === 'ancestor-or-self') {
            let matches = true;
            if (test.type === NODE_NAME_TEST && test.name !== '*') {
                const controlTypeId = CONTROL_TYPE_MAP[test.name.toLowerCase()];
                if (controlTypeId) {
                    try {
                        if (context.getCurrentPropertyValue(UIA.UIA_ControlTypePropertyId) !== controlTypeId) {
                            matches = false;
                        }
                    } catch {
                        matches = false;
                    }
                }
            }
            if (matches) {
                results = [context, ...results];
            }
        }

        // Apply JS filtering for ControlType if not already handled by axis match (context)
        if (test.type === NODE_NAME_TEST && test.name !== '*') {
            const controlTypeId = CONTROL_TYPE_MAP[test.name.toLowerCase()];
            if (controlTypeId) {
                results = results.filter(el => {
                    try {
                        return el.getCurrentPropertyValue(UIA.UIA_ControlTypePropertyId) === controlTypeId;
                    } catch {
                        return false;
                    }
                });
            } else {
                results = [];
            }
        }

        // Apply predicates
        for (const predicate of predicates) {
            results = await this.filterByPredicate(predicate, results);
        }

        return results;
    }

    private async filterByPredicate(predicate: any, elements: UIAElement[]): Promise<UIAElement[]> {
        if (predicate.type === NUMBER) {
            const index = predicate.number;
            if (index > 0 && index <= elements.length) {
                return [elements[index - 1]];
            }
            return [];
        }

        const filtered: UIAElement[] = [];
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const isMatch = await this.evaluatePredicate(predicate, el, i + 1, elements.length);
            if (isMatch) {
                filtered.push(el);
            }
        }
        return filtered;
    }

    private async evaluatePredicate(node: any, element: UIAElement, position: number, last: number): Promise<boolean> {
        switch (node.type) {
            case EQUALITY:
            case INEQUALITY:
                const lhs = await this.evaluateSubExpr(node.lhs, element, position, last);
                const rhs = await this.evaluateSubExpr(node.rhs, element, position, last);
                return node.type === EQUALITY ? lhs === rhs : lhs !== rhs;

            case NUMBER:
                return position === node.number;

            case AND:
                return (await this.evaluatePredicate(node.lhs, element, position, last)) &&
                    (await this.evaluatePredicate(node.rhs, element, position, last));

            case OR:
                return (await this.evaluatePredicate(node.lhs, element, position, last)) ||
                    (await this.evaluatePredicate(node.rhs, element, position, last));

            default:
                // If it's just a path existence test like [@Name]
                const results = await this.evaluateSubExpr(node, element, position, last);
                return !!results;
        }
    }

    private async evaluateSubExpr(node: any, element: UIAElement, position: number, last: number): Promise<any> {
        switch (node.type) {
            case LITERAL:
                return node.string;
            case NUMBER:
                return node.number;
            case FUNCTION_CALL:
                if (node.name === POSITION) return position;
                if (node.name === LAST) return last;
                return null;
            case RELATIVE_LOCATION_PATH:
                // Handle attributes like [@Name='foo']
                if (node.steps.length === 1 && node.steps[0].axis === ATTRIBUTE) {
                    const attrName = node.steps[0].test.name.toLowerCase();
                    const propId = PROPERTY_MAP[attrName];
                    if (propId) {
                        return element.getCurrentPropertyValue(propId);
                    }
                    return null;
                }
                // Handle sub-elements existence / Window[Button]
                const subResults = await this.evaluateSteps(node.steps, [element]);
                return subResults.length > 0;
            default:
                return null;
        }
    }

    private unique(elements: UIAElement[]): UIAElement[] {
        // Simple uniqueness based on element object? 
        // In UIA, we should compare RuntimeIds.
        const seen = new Set<string>();
        const result: UIAElement[] = [];
        for (const el of elements) {
            try {
                const id = el.getCurrentPropertyValue(UIA.UIA_RuntimeIdPropertyId);
                const idStr = Array.isArray(id) ? id.join(',') : String(id);
                if (!seen.has(idStr)) {
                    seen.add(idStr);
                    result.push(el);
                }
            } catch (e) {
                // If we can't get ID, assume it's unique or just add it
                result.push(el);
            }
        }
        return result;
    }
}
