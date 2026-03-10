import { Enum } from '../enums';
import { pwsh$, PSObject } from './core';
import { PSString } from './common';
import { Condition } from './conditions';

// TODO: Move the methods to a separate file, some of them are too complicated and are not easy to maintain
const FIND_ALL_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -eq $validEl) { continue };
            $els.Add($validEl);
        }
    }

    return $els;
`;

const FIND_FIRST_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);

    foreach ($el in ${0}) {
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -ne $validEl) {
                return $el;
            }
        }
    }
`;

const FIND_ALL_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -ne $validEl) {
                $els.Add($validEl);
            }

            $el = $treeWalker.GetParent($el);
        }
    }

    return $els;
`;

const FIND_FIRST_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -ne $validEl) {
                return $el;
            }

            $el = $treeWalker.GetParent($el);
        }
    }
`;

const FIND_PARENT = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);

    foreach ($el in ${0}) {
        return $treeWalker.GetParent($el).FindFirst([TreeScope]::Element, ${1});
    }
`;

const FIND_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}));

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $nextSibling = $treeWalker.GetNextSibling($el);

            if ($null -ne $nextSibling) {
                return $nextSibling;
            }

            $el = $treeWalker.GetParent($el);
        }
    }
`;

const FIND_ALL_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $nextSibling = $treeWalker.GetNextSibling($el);

            if ($null -ne $nextSibling) {
                $el = $nextSibling;
                $els.Add($el);
                foreach ($child in $el.FindAll([TreeScope]::Children, ${1})) { $els.Add($child); }
            }

            $el = $treeWalker.GetParent($el);
        }
    }

    return $els;
`;

const FIND_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);

    foreach ($el in ${0}) {
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -ne $validEl) {
                return $el;
            }
        }
    }
`;

const FIND_ALL_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -eq $validEl) { continue };
            $els.Add($validEl);
        }
    }

    return $els;
`;

const FIND_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}));

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $previousSibling = $treeWalker.GetPreviousSibling($el);

            if ($null -ne $previousSibling) {
                return $previousSibling;
            }

            $el = $treeWalker.GetParent($el);
        }
    }
`;

const FIND_ALL_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}));
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne $el) {
            $previousSibling = $treeWalker.GetPreviousSibling($el);

            if ($null -ne $previousSibling) {
                $el = $previousSibling;
                $els.Add($el);
                foreach ($child in $el.FindAll([TreeScope]::Children, ${1})) { $els.Add($child); }
            }

            $el = $treeWalker.GetParent($el);
        }
    }

    return $els;
`;

const FIND_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);

    foreach ($el in ${0}) {
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -ne $validEl) {
                return $el;
            }
        }
    }
`;

const FIND_ALL_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter);
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling;
            $validEl = $el.FindFirst([TreeScope]::Element, ${1});

            if ($null -eq $validEl) { continue };
            $els.Add($validEl);
        }
    }

    return $els;
`;

const FIND_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        $validEl = $el.FindFirst([TreeScope]::Element -bor [TreeScope]::Children, ${1});
        if ($null -ne $validEl) {
            $els.Add($validEl);
        }
    }

    return $els;
`;

const FIND_ALL_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement];

    foreach ($el in ${0}) {
        $validEl = $el.FindAll([TreeScope]::Element -bor [TreeScope]::Children, ${1});
        if ($null -ne $validEl) {
            foreach ($v in $validEl) {
                $els.Add($v);
            }
        }
    }

    return $els;
`;

const FIND_DESCENDANTS = pwsh$ /* ps1 */ `Find-Descendant -element (${0}) -condition (${1})`;
const FIND_ALL_DESCENDANTS = pwsh$ /* ps1 */ `Find-AllDescendants -element (${0}) -condition (${1})`;

const FIND_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-Descendant -element (${0}) -condition (${1}) -includeSelf`;
const FIND_ALL_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-AllDescendants -element (${0}) -condition (${1}) -includeSelf`;

const FIND_FIRST = pwsh$ /* ps1 */ `${0}.FindFirst([TreeScope]::${1}, ${2})`;
const FIND_ALL = pwsh$ /* ps1 */ `${0}.FindAll([TreeScope]::${1}, ${2})`;

const AUTOMATION_ROOT = /* ps1 */ `$rootElement`;
const FOCUSED_ELEMENT = /* ps1 */ `[AutomationElement]::FocusedElement`;
const ROOT_ELEMENT = /* ps1 */ `[AutomationElement]::RootElement`;

const SAVE_TO_ELEMENT_TABLE_AND_RETURN_ID = pwsh$ /* ps1 */ `
    ${0} | Where-Object { $null -ne $_ } | ForEach-Object {
        $runtimeId = $_.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.';

        if (-not $elementTable.ContainsKey($runtimeId)) {
            $elementTable.Add($runtimeId, $_)
        };

        $runtimeId
    }
`;

const ELEMENT_TABLE_GET = pwsh$ /* ps1 */ `$elementTable['${0}']`;

// TODO: maybe encode the result first? Some properties may be on multiple lines, it may cause a problem when returning multiple element results at once

const GET_ELEMENT_PROPERTY = pwsh$ /* ps1 */ `
    $el = ${0};
    try {
        $p = [System.Windows.Automation.AutomationElement]::${1}Property;
        $val = $el.GetCurrentPropertyValue($p);
        if ($null -ne $val) { return $val.ToString() };
    } catch { }
    return $null;
`;

const GET_ELEMENT_PATTERN_PROPERTY = pwsh$ /* ps1 */ `
    $el = ${0};
    if ($null -eq $el) { return $null };
    try {
        $pattern = $el.GetCurrentPattern([System.Windows.Automation.${1}Pattern]::Pattern);
        if ($null -ne $pattern) {
            $val = $pattern.Current.${2};
            if ($null -ne $val) { return $val.ToString() };
        }
    } catch { }
    return $null;
`;

const GET_ELEMENT_LEGACY_PROPERTY = pwsh$ /* ps1 */ `
    $el = ${0};
    if ($null -eq $el) { return $null };

    # 1. UIA LegacyIAccessiblePattern (most reliable - works for both Win32 and modern apps)
    try {
        $pattern = $el.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern);
        if ($null -ne $pattern) {
            $val = $pattern.Current.${1};
            if ($null -ne $val) { return $val.ToString() };
        }
    } catch { }

    # 2. Raw MSAA: hwnd first, then center-point fallback
    $hwnd = 0;
    try { $hwnd = [int]$el.Current.NativeWindowHandle; } catch { }
    $rect = $el.Current.BoundingRectangle;
    $centerX = [int]($rect.Left + $rect.Width / 2);
    $centerY = [int]($rect.Top + $rect.Height / 2);

    try {
        $val = [MSAAHelper]::GetLegacyPropertyWithFallback([IntPtr]$hwnd, $centerX, $centerY, "${1}");
        if ($null -ne $val) { return $val.ToString() };
    } catch { }

    return $null;
`;

const GET_ALL_ELEMENT_PROPERTIES = pwsh$ /* ps1 */ `
    $el = ${0};
    if ($null -eq $el) { return };

    $out = [ordered]@{};

    # 1. UIA direct + pattern properties via GetSupportedProperties()
    #    ProgrammaticName format:
    #      AutomationElementIdentifiers.<Prop>Property  -> key: <Prop>
    #      <Pattern>PatternIdentifiers.<Prop>Property   -> key: <Pattern>.<Prop>
    try {
        $props = $el.GetSupportedProperties();
        foreach($p in $props) {
            try {
                $val = $el.GetCurrentPropertyValue($p);
                if ($null -ne $val) {
                    $nameParts = $p.ProgrammaticName.Split('.');
                    $prefix = $nameParts[0];
                    $rawName = $nameParts[-1] -replace "Property$", "";

                    if ($prefix -eq "AutomationElementIdentifiers") {
                        $name = $rawName;
                    } else {
                        $patternName = $prefix -replace "PatternIdentifiers$", "";
                        $name = "$patternName.$rawName";
                    }

                    if ($val -is [Array]) {
                        $out[$name] = $val -join ",";
                    } else {
                        $out[$name] = $val.ToString();
                    }
                }
            } catch { }
        }
    } catch { }

    # 2. MSAA fallback for LegacyIAccessible props not already captured by UIA
    try {
        $hwnd = $el.Current.NativeWindowHandle;
        $rect = $el.Current.BoundingRectangle;
        $cx = [int]($rect.Left + $rect.Width / 2);
        $cy = [int]($rect.Top + $rect.Height / 2);

        $msaaProps = [MSAAHelper]::GetLegacyPropsWithFallback([IntPtr]$hwnd, $cx, $cy);
        if ($null -ne $msaaProps) {
            foreach($entry in $msaaProps.GetEnumerator()) {
                $key = "LegacyIAccessible." + $entry.Key;
                if (-not $out.Contains($key)) {
                    $out[$key] = $entry.Value.ToString();
                }
            }
        }
    } catch { }

    return $out | ConvertTo-Json -Depth 2 -Compress;
`;

const GET_ELEMENT_RUNTIME_ID = pwsh$ /* ps1 */ `
    try {
        ${0}.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.';
    } catch { }
`;

// TODO: [Huy] - Need to review to use Cached or Current
const GET_ELEMENT_RECT = pwsh$ /* ps1 */ `
    $rect = ${0}.Current.BoundingRectangle;
    $rect | Select-Object X, Y, Width, Height |
        ForEach-Object { $_ | ConvertTo-Json -Compress } |
        ForEach-Object {
            if ($null -eq $_) { return };
            $_.ToLower();
        }
`;

const GET_ELEMENT_TAG_NAME = pwsh$ /* ps1 */ `
    $ct = ${0}.Current.ControlType;
    $ct.ProgrammaticName | ForEach-Object {
        $type = $_.Split('.')[-1];
        if ($type -eq 'DataGrid') {
            return 'List';
        } elseif ($type -eq 'DataItem') {
            return 'ListItem';
        }
        return $type;
    }
`;

const SET_FOCUS_TO_ELEMENT = pwsh$ /* ps1 */ `${0}.SetFocus()`;

const GET_ELEMENT_TEXT = pwsh$ /* ps1 */ `
    try {
        return ${0}.GetCurrentPattern([TextPattern]::Pattern).DocumentRange.GetText(-1);
    } catch { }

    try {
        return ${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.GetSelection().Current.Name;
    } catch { }

    try {
        return ${0}.Current.Name;
    } catch { }
`;

const INVOKE_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([InvokePattern]::Pattern).Invoke()`;
const EXPAND_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Expand()`;
const COLLAPSE_ELEMENT = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Collapse()`;
const SCROLL_ELEMENT_INTO_VIEW = pwsh$ /* ps1 */ `
    $el = ${0};
    $runtimeIdStr = "${1}";

    if ($null -eq $el -and $runtimeIdStr) {
        # Attempt repair
        $targetIdArray = [int32[]]@($runtimeIdStr.Split('.'));
        $cond = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::RuntimeIdProperty, $targetIdArray);
        $found = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond);

        if ($null -ne $found) {
            $foundRuntimeId = $found.GetRuntimeId() -join '.';
            if (-not $elementTable.ContainsKey($foundRuntimeId)) {
                $elementTable.Add($foundRuntimeId, $found);
            }
            $el = $found;
        }
    }

    $el | Where-Object { $null -ne $_ } | ForEach-Object {
        # 1. Try ScrollItem Pattern
        try {
            $pattern = $_.GetCurrentPattern([ScrollItemPattern]::Pattern);
            if ($null -ne $pattern) {
                $pattern.ScrollIntoView();
                return;
            }
        } catch { }

        # 2. Try SetFocus
        try {
            $_.SetFocus();
            return;
        } catch { }

        # 3. Try LegacyIAccessible Select
        try {
            $legacy = $_.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern);
            if ($null -ne $legacy) {
                $legacy.Select(3); # 3 = TakeFocus
                return;
            }
        } catch { }

        throw "Failed to scroll into view.";
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
    try {
        ${0}.GetCurrentPattern([ValuePattern]::Pattern).SetValue(${1});
    } catch { } 
`;
const SET_ELEMENT_RANGE_VALUE = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([RangeValuePattern]::Pattern).SetValue(${1})`;
const GET_ELEMENT_VALUE = pwsh$ /* ps1 */ `
    try {
        return ${0}.GetCurrentPattern([ValuePattern]::Pattern).Current.Value;
    } catch { }
    return $null;
`;
const GET_ELEMENT_TOGGLE_STATE = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([TogglePattern]::Pattern).Current.ToggleState`;
const MAXIMIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Maximized)`;
const MINIMIZE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Minimized)`;
const RESTORE_WINDOW = pwsh$ /* ps1 */ `${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Normal)`;
const CLOSE_WINDOW = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Close(); } catch { } `;

const GET_ELEMENT_SCREENSHOT = pwsh$ /* ps1 */ `
    try {
        $el = ${0};
        $rect = $el.Current.BoundingRectangle;

        if ($el -eq $null -or $rect.Width -le 0 -or $rect.Height -le 0) {
            $bitmap = New-Object Drawing.Bitmap 1, 1;
            $stream = New-Object IO.MemoryStream;
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
            $bitmap.Dispose();
            return [Convert]::ToBase64String($stream.ToArray());
        }

        $bitmap = New-Object Drawing.Bitmap([int32]$rect.Width, [int32]$rect.Height);
        $graphics = [Drawing.Graphics]::FromImage($bitmap);
        try {
            $graphics.CopyFromScreen([int32]$rect.Left, [int32]$rect.Top, 0, 0, $bitmap.Size);
        } catch {
            $graphics.Clear([Drawing.Color]::Red);
        }
        $graphics.Dispose();

        $stream = New-Object IO.MemoryStream;
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
        $bitmap.Dispose();
        [Convert]::ToBase64String($stream.ToArray());
    } catch {
        $bitmap = New-Object Drawing.Bitmap 1, 1;
        $stream = New-Object IO.MemoryStream;
        $graphics = [Drawing.Graphics]::FromImage($bitmap);
        $graphics.Clear([Drawing.Color]::Red);
        $graphics.Dispose();
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
        $bitmap.Dispose();
        [Convert]::ToBase64String($stream.ToArray());
    }
`;

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

    buildGetPatternPropertyCommand(patternName: string, propName: string): string {
        return GET_ELEMENT_PATTERN_PROPERTY.format(this, patternName, propName);
    }

    buildGetLegacyPropertyCommand(propName: string): string {
        return GET_ELEMENT_LEGACY_PROPERTY.format(this, propName);
    }

    buildGetPropertyCommand(property: string): string {
        const proLower = property.toLowerCase();

        if (proLower === 'runtimeid') {
            return GET_ELEMENT_RUNTIME_ID.format(this);
        }

        if (proLower === 'controltype') {
            return GET_ELEMENT_TAG_NAME.format(this);
        }

        return GET_ELEMENT_PROPERTY.format(this, property);
    }

    buildGetAllPropertiesCommand(): string {
        return GET_ALL_ELEMENT_PROPERTIES.format(this);
    }

    buildGetElementRectCommand(): string {
        return GET_ELEMENT_RECT.format(this);
    }

    buildGetElementScreenshotCommand(): string {
        return GET_ELEMENT_SCREENSHOT.format(this);
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
        super(`@(${automationElements.map((el) => `(${el.buildCommand()})`).join(', ')} )`);
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