import { Enum } from '../enums';
import { pwsh$, PSObject } from './core';
import { PSString } from './common';
import { Condition } from './conditions';

// TODO: Move the methods to a separate file, some of them are too complicated and are not easy to maintain
const FIND_ALL_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -eq $validEl) { continue }
            $els.Add($validEl)
        }
    }

    return $els
`;

const FIND_FIRST_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    foreach ($el in ${0}) {
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                return $el
            }
        }
    }
`;

const FIND_ALL_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                $els.Add($validEl)
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    return $els
`;

const FIND_FIRST_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                return $el
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_PARENT = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    foreach ($el in ${0}) {
        return $treeWalker.GetParent($el).FindFirst([TreeScope]::Element, ${1})
    }
`;

const FIND_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $nextSibling = $treeWalker.GetNextSibling($el)

            if ($null -ne $nextSibling) {
                return $nextSibling
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_ALL_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $nextSibling = $treeWalker.GetNextSibling($el)

            if ($null -ne $nextSibling) {
                $el = $nextSibling
                $els.Add($el)
                $els.AddRange($el.FindAll([TreeScope]::Children, ${1}))
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    return $els
`;

const FIND_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    foreach ($el in ${0}) {
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                return $el
            }
        }
    }
`;

const FIND_ALL_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -eq $validEl) { continue }
            $els.Add($validEl)
        }
    }

    return $els
`;

const FIND_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $previousSibling = $treeWalker.GetPreviousSibling($el)

            if ($null -ne $previousSibling) {
                return $previousSibling
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_ALL_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $previousSibling = $treeWalker.GetPreviousSibling($el)

            if ($null -ne $previousSibling) {
                $el = $previousSibling
                $els.Add($el)
                $els.AddRange($el.FindAll([TreeScope]::Children, ${1}))
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    return $els
`;

const FIND_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    foreach ($el in ${0}) {
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                return $el
            }
        }
    }
`;

const FIND_ALL_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -eq $validEl) { continue }
            $els.Add($validEl)
        }
    }

    return $els
`;

const FIND_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        $validEl = $el.FindFirst([TreeScope]::Element -bor [TreeScope]::Children, ${1});
        if ($null -ne $validEl) {
            $els.Add($validEl)
        }
    }

    return $els
`;

const FIND_ALL_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    foreach ($el in ${0}) {
        $validEl = $el.FindAll([TreeScope]::Element -bor [TreeScope]::Children, ${1});
        if ($null -ne $validEl) {
            $els.Add($validEl)
        }
    }

    return $els
`;

const FIND_DESCENDANTS = pwsh$ /* ps1 */ `Find-ChildrenRecursively -element (${0}) -condition (${1})`;
const FIND_ALL_DESCENDANTS = pwsh$ /* ps1 */ `Find-AllChildrenRecursively -element (${0}) -condition (${1})`;

const FIND_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-ChildrenRecursively -element (${0}) -condition (${1}) -includeSelf $true`;
const FIND_ALL_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-AllChildrenRecursively -element (${0}) -condition (${1}) -includeSelf $true`;

const FIND_FIRST = pwsh$ /* ps1 */ `${0}.FindFirst([TreeScope]::${1}, ${2})`;
const FIND_ALL = pwsh$ /* ps1 */ `${0}.FindAll([TreeScope]::${1}, ${2})`;

const AUTOMATION_ROOT = /* ps1 */ `$rootElement`;
const FOCUSED_ELEMENT = /* ps1 */ `[AutomationElement]::FocusedElement`;
const ROOT_ELEMENT = /* ps1 */ `[AutomationElement]::RootElement`;

const SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID = pwsh$ /* ps1 */ `
    ${0} | ForEach-Object {
        if ($null -eq $_) { return }

        try {
            $runtimeId = $_.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.';
            if (-not $elementTable.ContainsKey($runtimeId)) {
                $elementTable.Add($runtimeId, $_)
            };
            $runtimeId
        } catch {
            # ElementNotAvailableException
        }
    }
`;

const ELEMENT_TABLE_GET = pwsh$ /* ps1 */ `
    $el = $elementTable['${0}'];
    if ($null -eq $el) { return $null }

    try {
        $null = $el.Current.ProcessId;
        return $el
    } catch {
        # $elementTable.Remove('${0}');
        return $el
    }
`;

// TODO: maybe encode the result first? Some properties may be on multiple lines, it may cause a problem when returning multiple element results at once
const GET_ELEMENT_PROPERTY = pwsh$ /* ps1 */ `
    $el = ${0}
    $target = ${1}

    if ($null -eq $el -or $null -eq $target) { 
        return $null
    }

    # 1. Normal Properties (Standard AutomationElement direct properties)
    # Check if the target matches a standard AutomationElement property (e.g. "Name", "AccessKey")
    # Only try this for simple property names (no dots)
    if (-not $target.Contains(".")) {
        try {
            $prop = [System.Windows.Automation.AutomationElement]::($target + "Property")
            if ($null -ne $prop) {
                $val = $el.GetCurrentPropertyValue($prop)
                if ($null -ne $val) { return $val.ToString() }
            }
        } catch {}
    }

    # 2. Pattern Properties (Pattern.Property)
    if ($target.Contains(".")) {
        $parts = $target.Split(".")
        $pKey = $parts[0]
        $propName = $parts[1]

        # 2a. Generic Pattern Property Handler (UIA)
        $patObj = $null
        switch ($pKey) {
            # "LegacyIAccessible" { $patObj = [System.Windows.Automation.LegacyIAccessiblePattern]::Pattern }
            "Value"             { $patObj = [System.Windows.Automation.ValuePattern]::Pattern }
            "Window"            { $patObj = [System.Windows.Automation.WindowPattern]::Pattern }
            "Transform"         { $patObj = [System.Windows.Automation.TransformPattern]::Pattern }
            "Scroll"            { $patObj = [System.Windows.Automation.ScrollPattern]::Pattern }
            "Selection"         { $patObj = [System.Windows.Automation.SelectionPattern]::Pattern }
            "SelectionItem"     { $patObj = [System.Windows.Automation.SelectionItemPattern]::Pattern }
            "RangeValue"        { $patObj = [System.Windows.Automation.RangeValuePattern]::Pattern }
            "ExpandCollapse"    { $patObj = [System.Windows.Automation.ExpandCollapsePattern]::Pattern }
            "Toggle"            { $patObj = [System.Windows.Automation.TogglePattern]::Pattern }
            "Grid"              { $patObj = [System.Windows.Automation.GridPattern]::Pattern }
            "GridItem"          { $patObj = [System.Windows.Automation.GridItemPattern]::Pattern }
            "Dock"              { $patObj = [System.Windows.Automation.DockPattern]::Pattern }
            "Table"             { $patObj = [System.Windows.Automation.TablePattern]::Pattern }
            "TableItem"         { $patObj = [System.Windows.Automation.TableItemPattern]::Pattern }
            "MultipleView"      { $patObj = [System.Windows.Automation.MultipleViewPattern]::Pattern }
            "Invoke"            { $patObj = [System.Windows.Automation.InvokePattern]::Pattern }
        }

        if ($null -ne $patObj) {
            try {
                $currPat = $el.GetCurrentPattern($patObj)
                if ($null -ne $currPat) {
                    # Dynamically access the property requested (e.g. IsReadOnly from Value.IsReadOnly)
                    $val = $currPat.Current.$propName
                    if ($null -ne $val) { return $val.ToString() }
                }
            } catch {}
        }

        # 2b. MSAA Fallback (LegacyIAccessible or Value)
        if ($pKey -eq "LegacyIAccessible" -or $pKey -eq "Value") {
            try {
                $hwnd = $el.Current.NativeWindowHandle
                if ($hwnd -gt 0) {
                    $msaaVal = [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, $propName)
                    if ($null -ne $msaaVal) { return $msaaVal.ToString() }
                }
            } catch {}
        }

        # 2c. MSAA Fallback (Point-based)
        if ($pKey -eq "LegacyIAccessible" -or $pKey -eq "Value") {
            try {
                $rect = $el.Current.BoundingRectangle
                if ($null -ne $rect -and $rect.Width -gt 0) {
                    $cx = [int]($rect.Left + $rect.Width/2)
                    $cy = [int]($rect.Top + $rect.Height/2)
                    $props = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy)
                    if ($null -ne $props) { 
                        $val = $props[$propName]
                        if ($null -ne $val) { return $val.ToString() }
                    }
                }
            } catch {}
        }
    }

    # If specifically looking for LegacyIAccessible and fallback failed, do NOT try fuzzy match to avoid ArgumentNullException
    if ($target -like "LegacyIAccessible*") { 
        return $null 
    }

    # 3. Supported Properties Category (Fuzzy / programmatic name match)
    # This searches all properties supported by the element (Pattern properties included)
    try {
        $supportedProps = $el.GetSupportedProperties()
        foreach ($prop in $supportedProps) {
            if ($prop.ProgrammaticName -like "*$target*") {
                $val = $el.GetCurrentPropertyValue($prop)
                if ($null -ne $val) { return $val.ToString() }
            }
        }
    } catch {}

    return $null
`;

const GET_ELEMENT_RUNTIME_ID = pwsh$ /* ps1 */ `
    try {
        ${0}.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.'
    } catch {
        # ElementNotAvailableException
    }
`;

// TODO: [Huy] - Need to review to use Cached or Current
const GET_ELEMENT_RECT = pwsh$ /* ps1 */ `
    if ($null -eq ${0}) { return }

    $rect = ${0}.Current.BoundingRectangle
    $rect | Select-Object X, Y, Width, Height |
    ForEach-Object { $_ | ConvertTo-Json -Compress } |
    ForEach-Object { 
        if ($null -eq $_) { return }
        $_.ToLower() 
    }
`;

const GET_ELEMENT_TAG_NAME = pwsh$ /* ps1 */ `
    if ($null -eq ${0}) { return }

    # try { $ct = $_.Cached.ControlType } catch { $ct = $_.Current.ControlType }
    $ct = ${0}.Current.ControlType
    $ct.ProgrammaticName |
    ForEach-Object {
        $type = $_.Split('.')[-1];
        if ($type -eq 'DataGrid') {
            return 'List'
        } elseif ($type -eq 'DataItem') {
            return 'ListItem'
        }
        return $type
    }
`;

const GET_ALL_ELEMENT_PROPERTIES = pwsh$ /* ps1 */ ``;

const SET_FOCUS_TO_ELEMENT = pwsh$ /* ps1 */ `${0}.SetFocus() `;

const GET_ELEMENT_TEXT = pwsh$ /* ps1 */ `
    try {
        return ${0}.GetCurrentPattern([TextPattern]::Pattern).DocumentRange.GetText(-1)
    } catch { }

    try {
        return ${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.GetSelection().Current.Name
    } catch { }

    try {
        return ${0}.Current.Name
    } catch { }
`;

const INVOKE_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([InvokePattern]::Pattern).Invoke()`;
const EXPAND_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Expand()`;
const COLLAPSE_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Collapse()`;
const SCROLL_ELEMENT_INTO_VIEW = pwsh$ /* ps1 */ `
    $el = ${0}
    $runtimeIdStr = "${1}"

    if ($null -eq $el -and $runtimeIdStr) {
        # Attempt repair
        $targetIdArray = [int32[]]@($runtimeIdStr.Split('.'))
        $cond = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::RuntimeIdProperty, $targetIdArray)
        $found = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
        
        if ($null -ne $found) {
            $foundRuntimeId = $found.GetRuntimeId() -join '.'
            if (-not $elementTable.ContainsKey($foundRuntimeId)) {
                $elementTable.Add($foundRuntimeId, $found)
            }
            $el = $found
        }
    }

    $el | Where-Object { $null -ne $_ } | ForEach-Object {
    # 1. Try ScrollItem Pattern (Standard UIA)
    try {
        $pattern = $_.GetCurrentPattern([ScrollItemPattern]::Pattern);
        if ($null -ne $pattern) {
            $pattern.ScrollIntoView()
            return
        }
    } catch { }

    # 2. Try SetFocus (Often scrolls element into view)
    try {
        $_.SetFocus()
        return
    } catch { }

    # 3. Try LegacyIAccessible Select (TakeFocus)
    try {
        $legacy = $_.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern);
        if ($null -ne $legacy) {
            $legacy.Select(3); # 3 = TakeFocus
            return
        }
    } catch { }

    # 4. Try ItemContainerPattern on Parent (For virtualized lists)
    try {
        $parent = [TreeWalker]::ControlViewWalker.GetParent($_);
        if ($null -ne $parent) {
            $containerPattern = $parent.GetCurrentPattern([ItemContainerPattern]::Pattern);
            if ($null -ne $containerPattern) {
                # Re-find the item using the container pattern which can trigger virtualization
                $found = $containerPattern.FindItemByProperty($null, [AutomationElement]::RuntimeIdProperty, $_.GetRuntimeId());
                if ($null -ne $found) {
                    # Try scrolling the fresh reference
                    $foundPattern = $found.GetCurrentPattern([ScrollItemPattern]::Pattern);
                    if ($null -ne $foundPattern) {
                        $foundPattern.ScrollIntoView()
                        return
                    }
                    $found.SetFocus()
                    return
                }
            }
        }
    } catch { }

    throw "Failed to scroll into view: ScrollItemPattern not supported, and SetFocus/LegacySelect/ItemContainerPattern fallbacks failed."
}
`;
const IS_MULTIPLE_SELECT_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.CanSelectMultiple`;
const GET_SELECTED_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.GetSelection()`;
const IS_ELEMENT_SELECTED = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).Current.IsSelected`;
const ADD_ELEMENT_TO_SELECTION = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).AddToSelection()`;
const REMOVE_ELEMENT_FROM_SELECTION = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).RemoveFromSelection()`;
const SELECT_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).Select()`;
const TOGGLE_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TogglePattern]::Pattern).Toggle()`;
const SET_ELEMENT_VALUE = pwsh$ /* ps1 */ `
${0} | ForEach-Object {
    if ($null -eq $_) { return }

    try {
        return $_.GetCurrentPattern([ValuePattern]::Pattern).SetValue(${1})
    } catch { } 
    
    # try {
    #     $hwnd = $_.Current.NativeWindowHandle
    #     if ($hwnd -gt 0) {
    #         [MSAAHelper]::SetLegacyValue([IntPtr]$hwnd, ${1})
    #     }
    # } catch { }
}
`;
const SET_ELEMENT_RANGE_VALUE = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([RangeValuePattern]::Pattern).SetValue(${1})`;
const GET_ELEMENT_VALUE = pwsh$ /* ps1 */ `
${0} | ForEach-Object {
    if ($null -eq $_) { return }

    try {
        return $_.GetCurrentPattern([ValuePattern]::Pattern).Current.Value
    } catch { }

    # try {
    #     $hwnd = $_.Current.NativeWindowHandle
    #     if ($hwnd -gt 0) {
    #         return [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, "accValue")
    #     } 
    #     
    #     return $null
    # } catch { return $null }
}
`;
const GET_ELEMENT_TOGGLE_STATE = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TogglePattern]::Pattern).Current.ToggleState`;
const MAXIMIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Maximized)`;
const MINIMIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Minimized)`;
const RESTORE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Normal)`;
const CLOSE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).Close()`;

export const TreeScope = Object.freeze({
    ANCESTORS_OR_SELF: 'ancestors-or-self',
    FOLLOWING: 'following',
    FOLLOWING_SIBLING: 'following-sibling',
    PRECEDING: 'preceding',
    PRECEDING_SIBLING: 'preceding-sibling',
    ANCESTORS: 'ancestors',
    CHILDREN_OR_SELF: 'child-or-self',
    CHILDREN: 'children',
    DESCENDANTS: 'descendants',
    ELEMENT: 'element',
    SUBTREE: 'subtree',
    PARENT: 'parent',
});

export type TreeScope = Enum<typeof TreeScope>;

export const AutomationElementMode = Object.freeze({
    NONE: 'none',
    FULL: 'full',
});

export type AutomationElementMode = Enum<typeof AutomationElementMode>;

export class AutomationElement extends PSObject {
    constructor(command: string) {
        super(command);
    }

    static get automationRoot(): AutomationElement {
        return new AutomationElement(AUTOMATION_ROOT);
    }

    static get rootElement(): AutomationElement {
        return new AutomationElement(ROOT_ELEMENT);
    }

    static get focusedElement(): AutomationElement {
        return new AutomationElement(FOCUSED_ELEMENT);
    }

    findFirst(scope: TreeScope, condition: Condition): AutomationElement {
        switch (scope) {
            case TreeScope.ANCESTORS_OR_SELF:
                return new AutomationElement(FIND_FIRST_ANCESTOR_OR_SELF.format(this, condition));
            case TreeScope.ANCESTORS:
                return new AutomationElement(FIND_FIRST_ANCESTOR.format(this, condition));
            case TreeScope.PARENT:
                return new AutomationElement(FIND_PARENT.format(this, condition));
            case TreeScope.FOLLOWING:
                return new AutomationElement(FIND_FOLLOWING.format(this, condition));
            case TreeScope.FOLLOWING_SIBLING:
                return new AutomationElement(FIND_FOLLOWING_SIBLING.format(this, condition));
            case TreeScope.PRECEDING:
                return new AutomationElement(FIND_PRECEDING.format(this, condition));
            case TreeScope.PRECEDING_SIBLING:
                return new AutomationElement(FIND_PRECEDING_SIBLING.format(this, condition));
            case TreeScope.CHILDREN_OR_SELF:
                return new AutomationElement(FIND_CHILDREN_OR_SELF.format(this, condition));
            case TreeScope.DESCENDANTS:
                return new AutomationElement(FIND_DESCENDANTS.format(this, condition));
            case TreeScope.SUBTREE:
                return new AutomationElement(FIND_DESCENDANTS_OR_SELF.format(this, condition));
            default:
                return new AutomationElement(FIND_FIRST.format(this, scope, condition));
        }
    }

    findAll(scope: TreeScope, condition: Condition): AutomationElement {
        switch (scope) {
            case TreeScope.ANCESTORS_OR_SELF:
                return new AutomationElement(FIND_ALL_ANCESTOR_OR_SELF.format(this, condition));
            case TreeScope.ANCESTORS:
                return new AutomationElement(FIND_ALL_ANCESTOR.format(this, condition));
            case TreeScope.PARENT:
                return new AutomationElement(FIND_PARENT.format(this, condition));
            case TreeScope.FOLLOWING:
                return new AutomationElement(FIND_ALL_FOLLOWING.format(this, condition));
            case TreeScope.FOLLOWING_SIBLING:
                return new AutomationElement(FIND_ALL_FOLLOWING_SIBLING.format(this, condition));
            case TreeScope.PRECEDING:
                return new AutomationElement(FIND_ALL_PRECEDING.format(this, condition));
            case TreeScope.PRECEDING_SIBLING:
                return new AutomationElement(FIND_ALL_PRECEDING_SIBLING.format(this, condition));
            case TreeScope.CHILDREN_OR_SELF:
                return new AutomationElement(FIND_ALL_CHILDREN_OR_SELF.format(this, condition));
            case TreeScope.DESCENDANTS:
                return new AutomationElement(FIND_ALL_DESCENDANTS.format(this, condition));
            case TreeScope.SUBTREE:
                return new AutomationElement(FIND_ALL_DESCENDANTS_OR_SELF.format(this, condition));
            default:
                return new AutomationElement(FIND_ALL.format(this, scope, condition));
        }
    }

    buildGetTagNameCommand(): string {
        return GET_ELEMENT_TAG_NAME.format(this);
    }

    buildGetPropertyCommand(property: string): string {
        if (property.toLowerCase() === 'all') {
            return this.buildGetAllPropertiesCommand();
        }

        if (property.toLowerCase() === 'runtimeid') {
            return GET_ELEMENT_RUNTIME_ID.format(this);
        }

        if (property.toLowerCase() === 'controltype') {
            return GET_ELEMENT_TAG_NAME.format(this);
        }

        const legacyPropsAlias = {
            'LegacyName': 'LegacyIAccessible.Name',
            'LegacyValue': 'LegacyIAccessible.Value',
            'LegacyDescription': 'LegacyIAccessible.Description',
            'LegacyHelp': 'LegacyIAccessible.Help',
            'LegacyDefaultAction': 'LegacyIAccessible.DefaultAction',
            'LegacyKeyboardShortcut': 'LegacyIAccessible.KeyboardShortcut',
            'LegacyRole': 'LegacyIAccessible.Role',
            'LegacyState': 'LegacyIAccessible.State',
            'LegacyChildId': 'LegacyIAccessible.ChildId',
            'LegacySelection': 'LegacyIAccessible.Selection'
        }

        if (legacyPropsAlias[property]) {
            property = legacyPropsAlias[property];
        }

        return GET_ELEMENT_PROPERTY.format(this, new PSString(property).toString());
    }

    buildGetAllPropertiesCommand(): string {
        return GET_ALL_ELEMENT_PROPERTIES.format(this);
    }

    buildGetElementRectCommand(): string {
        return GET_ELEMENT_RECT.format(this);
    }

    buildSetFocusCommand(): string {
        return SET_FOCUS_TO_ELEMENT.format(this);
    }

    buildCommand(): string {
        return SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID.format(this);
    }
}

export class AutomationElementGroup extends AutomationElement {
    readonly groups: AutomationElement[];

    constructor(...automationElements: AutomationElement[]) {
        super(`@( ${automationElements.map((el) => `(${el.buildCommand()})`).join(', ')} )`);
        this.groups = automationElements;
    }

    findAllGroups(scope: TreeScope, condition: Condition): AutomationElement[] {
        return this.groups.map((el) => el.findAll(scope, condition));
    }

    findFirstGroups(scope: TreeScope, condition: Condition): AutomationElement[] {
        return this.groups.map((el) => el.findFirst(scope, condition));
    }
}

export class FoundAutomationElement extends AutomationElement {
    readonly runtimeId: string;

    constructor(runtimeId: string) {
        super(ELEMENT_TABLE_GET.format(runtimeId));
        this.runtimeId = runtimeId;
    }

    buildGetTextCommand(): string {
        return GET_ELEMENT_TEXT.format(this);
    }

    buildInvokeCommand(): string {
        return INVOKE_ELEMENT.format(this);
    }

    buildExpandCommand(): string {
        return EXPAND_ELEMENT.format(this);
    }

    buildCollapseCommand(): string {
        return COLLAPSE_ELEMENT.format(this);
    }

    buildScrollIntoViewCommand(): string {
        return SCROLL_ELEMENT_INTO_VIEW.format(this, this.runtimeId);
    }

    buildIsMultipleSelectCommand(): string {
        return IS_MULTIPLE_SELECT_ELEMENT.format(this);
    }

    buildGetSelectionCommand(): string {
        return SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID.format(GET_SELECTED_ELEMENT.format(this));
    }

    buildIsSelectedCommand(): string {
        return IS_ELEMENT_SELECTED.format(this);
    }

    buildAddToSelectionCommand(): string {
        return ADD_ELEMENT_TO_SELECTION.format(this);
    }

    buildRemoveFromSelectionCommand(): string {
        return REMOVE_ELEMENT_FROM_SELECTION.format(this);
    }

    buildSelectCommand(): string {
        return SELECT_ELEMENT.format(this);
    }

    buildToggleCommand(): string {
        return TOGGLE_ELEMENT.format(this);
    }

    buildSetValueCommand(value: string): string {
        return SET_ELEMENT_VALUE.format(this, new PSString(value).toString());
    }

    buildSetRangeValueCommand(value: string): string {
        return SET_ELEMENT_RANGE_VALUE.format(this, Number(value).toString());
    }

    buildGetValueCommand(): string {
        return GET_ELEMENT_VALUE.format(this);
    }

    buildGetToggleStateCommand(): string {
        return GET_ELEMENT_TOGGLE_STATE.format(this);
    }

    buildMaximizeCommand(): string {
        return MAXIMIZE_WINDOW.format(this);
    }

    buildMinimizeCommand(): string {
        return MINIMIZE_WINDOW.format(this);
    }

    buildRestoreCommand(): string {
        return RESTORE_WINDOW.format(this);
    }

    buildCloseCommand(): string {
        return CLOSE_WINDOW.format(this);
    }

    override buildCommand(): string {
        return this.toString();
    }
}