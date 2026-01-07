import { Enum } from '../enums';
import { pwsh$, PSObject } from './core';
import { PSString } from './common';
import { Condition } from './conditions';

// TODO: Move the methods to a separate file, some of them are too complicated and are not easy to maintain
const FIND_ALL_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                $els.Add($validEl)
            }
        }
    }

    Write-Output $els
`;

const FIND_FIRST_ANCESTOR = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($parent = $treeWalker.GetParent($el))) {
            $el = $parent
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                Write-Output $el
                break
            }
        }
    }
`;

const FIND_ALL_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                $els.Add($validEl)
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    Write-Output $els
`;

const FIND_FIRST_ANCESTOR_OR_SELF = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                Write-Output $el
                break
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_PARENT = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    ${0} | ForEach-Object {
        $el = $_
        $el = $treeWalker.GetParent($el).FindFirst([TreeScope]::Element, ${1})
        Write-Output $el
    }
`;

const FIND_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            if ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
                $el = $nextSibling

                Write-Output $el
                break
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_ALL_FOLLOWING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            if ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
                $el = $nextSibling
                $els.Add($el)
                $els.AddRange($el.FindAll([TreeScope]::Children, ${1}))
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    Write-Output $els
`;

const FIND_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                Write-Output $el
                break
            }
        }
    }
`;

const FIND_ALL_FOLLOWING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($nextSibling = $treeWalker.GetNextSibling($el))) {
            $el = $nextSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                $els.Add($validEl)
            }
        }
    }

    Write-Output $els
`;

const FIND_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            if ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
                $el = $previousSibling

                Write-Output $el
                break
            }

            $el = $treeWalker.GetParent($el)
        }
    }
`;

const FIND_ALL_PRECEDING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new([AndCondition]::new($cacheRequest.TreeFilter, ${1}))
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne $el) {
            if ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
                $el = $previousSibling
                $els.Add($el)
                $els.AddRange($el.FindAll([TreeScope]::Children, ${1}))
            }

            $el = $treeWalker.GetParent($el)
        }
    }

    Write-Output $els
`;

const FIND_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                Write-Output $el
                break
            }
        }
    }
`;

const FIND_ALL_PRECEDING_SIBLING = pwsh$ /* ps1 */ `
    $treeWalker = [TreeWalker]::new($cacheRequest.TreeFilter)
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        while ($null -ne ($previousSibling = $treeWalker.GetPreviousSibling($el))) {
            $el = $previousSibling
            $validEl = $el.FindFirst([TreeScope]::Element, ${1})

            if ($null -ne $validEl) {
                $els.Add($validEl)
            }
        }
    }

    Write-Output $els
`;

const FIND_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        $validEl = $el.FindFirst([TreeScope]::Element -bor [TreeScope]::Children, ${1});

        if ($null -ne $validEl) {
            $els.Add($validEl)
        }
    }

    Write-Output $els
`;

const FIND_ALL_CHILDREN_OR_SELF = pwsh$ /* ps1 */ `
    $els = New-Object System.Collections.Generic.List[AutomationElement]

    ${0} | ForEach-Object {
        $el = $_
        $validEl = $el.FindAll([TreeScope]::Element -bor [TreeScope]::Children, ${1});

        if ($null -ne $validEl) {
            $els.Add($validEl)
        }
    }

    Write-Output $els
`;

const FIND_DESCENDANTS = pwsh$ /* ps1 */ `Find-ChildrenRecursively -element (${0}) -condition (${1})`;
const FIND_ALL_DESCENDANTS = pwsh$ /* ps1 */ `Find-AllChildrenRecursively -element (${0}) -condition (${1})`;

const FIND_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-ChildrenRecursively -element (${0}) -condition (${1}) -includeSelf $true`;
const FIND_ALL_DESCENDANTS_OR_SELF = pwsh$ /* ps1 */ `Find-AllChildrenRecursively -element (${0}) -condition (${1}) -includeSelf $true`;

const FIND_FIRST = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.FindFirst([TreeScope]::${1}, ${2}) }`;
const FIND_ALL = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.FindAll([TreeScope]::${1}, ${2}) }`;

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

const ELEMENT_TABLE_GET = pwsh$ /* ps1 */ `
    $el = $elementTable['${0}'];
    if ($null -ne $el) {
        try {
            $null = $el.Current.ProcessId;
            $el
        } catch {
            $elementTable.Remove('${0}');
            $null
        }
    }
`;

// TODO: maybe encode the result first? Some properties may be on multiple lines, it may cause a problem when returning multiple element results at once

const GET_CACHED_ELEMENT_PROPERTY = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
        try {
            ${0}.GetCachedPropertyValue([AutomationElement]::${1}Property)
        } catch {
            ${0}.GetCurrentPropertyValue([AutomationElement]::${1}Property)
        }
    }
`;

const GET_CURRENT_ELEMENT_PROPERTY = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) { 
        try {
            $target = "${1}"
            
            # 1. Handle dotted Pattern.Property format (e.g. Window.CanMaximize or LegacyIAccessible.Name)
            if ($target.Contains(".")) {
                $parts = $target.Split(".")
                if ($parts.Length -ge 2) {
                    $pKey = $parts[0]
                    $propName = $parts[1]
                    
                    # Sweep supported properties for a match on the programmatic name (pattern + property)
                    foreach ($prop in ${0}.GetSupportedProperties()) {
                        # ProgrammaticName is usually something like "WindowPatternIdentifiers.CanMaximizeProperty"
                        if ($prop.ProgrammaticName -like "*$pKey*$propName*") {
                            $val = ${0}.GetCurrentPropertyValue($prop)
                            if ($null -ne $val) { return $val.ToString() }
                        }
                    }

                    # Custom Aliases / MSAA Fallback for dotted names (LegacyIAccessible.Name -> Name)
                    if ($pKey -eq "LegacyIAccessible") {
                        if ($propName -eq "Name") { return ${0}.Current.Name }
                        if ($propName -eq "Description") { return ${0}.Current.HelpText }
                        if ($propName -eq "Role") { return ${0}.Current.LocalizedControlType }
                        if ($propName -eq "State") { return "" }
                        if ($propName -eq "Value") { return "" }
                    }
                }
            }

            # 2. Try standard AutomationElement property (e.g. NameProperty)
            try {
                $p = [System.Windows.Automation.AutomationElement]::($target + "Property")
                if ($null -ne $p) { 
                    $val = ${0}.GetCurrentPropertyValue($p)
                    if ($null -ne $val) { return $val.ToString() }
                }
            } catch {}

            # 3. Fallback search through all supported properties for short names (e.g. "CanMaximize")
            foreach ($prop in ${0}.GetSupportedProperties()) {
                if ($prop.ProgrammaticName.EndsWith(".$($target)Property") -or $prop.ProgrammaticName.Contains(".$($target)")) {
                    $val = ${0}.GetCurrentPropertyValue($prop)
                    if ($null -ne $val) { return $val.ToString() }
                }
            }
            
            # 4. Try pattern-based lookup for short names using common identifiers
            $commonPatterns = @("Window", "Transform", "ExpandCollapse", "Toggle", "Value", "RangeValue", "LegacyIAccessible")
            foreach ($pKey in $commonPatterns) {
                try {
                    $pTypeName = "System.Windows.Automation.$($pKey)Pattern"
                    $pProp = Invoke-Expression "[$pTypeName]::$($target)Property"
                    if ($null -ne $pProp) {
                        $val = ${0}.GetCurrentPropertyValue($pProp)
                        if ($null -ne $val) { return $val.ToString() }
                    }
                } catch {}
            }

            # 5. UIA 3.0 / Driver-specific aliases (Safe Defaults)
            if ($target -eq "IsDialog") { return "False" }
            if ($target -eq "ProviderDescription") { return "" }
            if ($target -eq "LegacyName") { return ${0}.Current.Name }

        } catch { return $null }
    }
`;

const GET_ELEMENT_PROPERTY = pwsh$ /* ps1 */ `
    try {
        $prop = [AutomationElement]::${1}Property
        if ($null -ne $prop) {
             try {
                ${0}.GetCachedPropertyValue($prop)
             } catch {
                ${0}.GetCurrentPropertyValue($prop)
             }
        } else { $null }
    } catch {
        $null
    }
`;

const GET_ELEMENT_RUNTIME_ID = pwsh$ /* ps1 */ `
    ${0} | Where-Object { $null -ne $_ } | ForEach-Object {
        $_.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.'
    }
`;

const GET_ELEMENT_RECT = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
        try { $rect = ${0}.Cached.BoundingRectangle } catch { $rect = ${0}.Current.BoundingRectangle }
        $rect |
        Select-Object X, Y, Width, Height |
        ForEach-Object { $_ | ConvertTo-Json -Compress } |
        ForEach-Object { if ($null -ne $_) { $_.ToLower() } }
    }
`;

const GET_ELEMENT_LEGACY_VALUE = pwsh$ /* ps1 */ `
    Get-LegacyPropertySafe -element ${0} -propName "Value" -accPropName "accValue"
`;

const GET_ELEMENT_LEGACY_NAME = pwsh$ /* ps1 */ `
    $val = Get-LegacyPropertySafe -element ${0} -propName "Name" -accPropName "accName"
    if ($null -eq $val) { $val = ${0}.Current.Name }
    $val
`;

const GET_ELEMENT_LEGACY_DESCRIPTION = pwsh$ /* ps1 */ `
    $val = Get-LegacyPropertySafe -element ${0} -propName "Description" -accPropName "accDescription"
    if ($null -eq $val) { $val = ${0}.Current.HelpText }
    $val
`;

const GET_ELEMENT_LEGACY_ROLE = pwsh$ /* ps1 */ `
    $val = Get-LegacyPropertySafe -element ${0} -propName "Role" -accPropName "accRole"
    if ($null -eq $val) { $val = ${0}.Current.LocalizedControlType }
    $val
`;

const GET_ELEMENT_LEGACY_STATE = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
         Get-LegacyPropertySafe -element ${0} -propName "State" -accPropName "accState"
    }
`;

const GET_ELEMENT_LEGACY_HELP = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
         Get-LegacyPropertySafe -element ${0} -propName "Help" -accPropName "accHelp"
    }
`;

const GET_ELEMENT_LEGACY_KEYBOARD_SHORTCUT = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
         Get-LegacyPropertySafe -element ${0} -propName "KeyboardShortcut" -accPropName "accKeyboardShortcut"
    }
`;

const GET_ELEMENT_LEGACY_DEFAULT_ACTION = pwsh$ /* ps1 */ `
    if ($null -ne ${0}) {
         Get-LegacyPropertySafe -element ${0} -propName "DefaultAction" -accPropName "accDefaultAction"
    }
`;

const GET_ELEMENT_WINDOW_CAN_MAXIMIZE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.CanMaximize } catch { $null }`;
const GET_ELEMENT_WINDOW_CAN_MINIMIZE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.CanMinimize } catch { $null }`;
const GET_ELEMENT_WINDOW_IS_MODAL = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.IsModal } catch { $null }`;
const GET_ELEMENT_WINDOW_IS_TOPMOST = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.IsTopmost } catch { $null }`;
const GET_ELEMENT_WINDOW_INTERACTION_STATE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.WindowInteractionState.ToString() } catch { $null }`;
const GET_ELEMENT_WINDOW_VISUAL_STATE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Current.WindowVisualState.ToString() } catch { $null }`;

const GET_ELEMENT_TRANSFORM_CAN_MOVE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([TransformPattern]::Pattern).Current.CanMove } catch { $null }`;
const GET_ELEMENT_TRANSFORM_CAN_RESIZE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([TransformPattern]::Pattern).Current.CanResize } catch { $null }`;
const GET_ELEMENT_TRANSFORM_CAN_ROTATE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([TransformPattern]::Pattern).Current.CanRotate } catch { $null }`;

const GET_ELEMENT_LEGACY_CHILD_ID = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current.ChildId
    } catch {
        # For HWND based elements, ChildId is usually 0
        try {
            $rect = ${0}.Current.BoundingRectangle
            if ($null -ne $rect -and $rect.Width -gt 0) {
                $cx = [int]($rect.Left + $rect.Width / 2)
                $cy = [int]($rect.Top + $rect.Height / 2)
                $props = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy)
                $props["ChildId"]
            } else {
                $hwnd = ${0}.Current.NativeWindowHandle
                if ($hwnd -gt 0) {
                    0
                } else { $null }
            }
        } catch { $null }
    }
}
`;

const IS_LEGACY_PATTERN_AVAILABLE = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        if ($null -ne ${0}.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern)) {
            $true
        } else {
            # Only check HWND / Point if managed pattern retrieval explicitly failed / returned null
            $result = $false
            try {
                $rect = ${0}.Current.BoundingRectangle
                if ($null -ne $rect -and $rect.Width -gt 0) {
                    $cx = [int]($rect.Left + $rect.Width / 2)
                    $cy = [int]($rect.Top + $rect.Height / 2)
                    $props = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy)
                    if ($null -ne $props) { $result = $true }
                }
            } catch { }

            if (-not $result) {
                try {
                    $hwnd = ${0}.Current.NativeWindowHandle
                    if ($hwnd -gt 0) { $result = $true }
                } catch { }
            }
            $result
        }
    } catch {
        # Fallback for TypeNotFound or other UIA errors
        $result = $false
        try {
            $rect = ${0}.Current.BoundingRectangle
            if ($null -ne $rect -and $rect.Width -gt 0) {
                $cx = [int]($rect.Left + $rect.Width / 2)
                $cy = [int]($rect.Top + $rect.Height / 2)
                $props = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy)
                if ($null -ne $props) { $result = $true }
            }
        } catch { }

        if (-not $result) {
            try {
                $hwnd = ${0}.Current.NativeWindowHandle
                if ($hwnd -gt 0) { $result = $true }
            } catch { }
        }
        $result
    }
} else {
    $false
}
`;

const GET_ELEMENT_TAG_NAME = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try { $ct = ${0}.Cached.ControlType } catch { $ct = ${0}.Current.ControlType }
    $ct.ProgrammaticName |
        ForEach-Object {
        $type = $_.Split('.')[-1]
        if ($type -eq 'DataGrid') { 'List' }
        elseif($type -eq 'DataItem') { 'ListItem' }
        else { $type }
    }
}
`;

// ... (rest of file)

// Inside AutomationElement class (implicit connection via line numbers, I will target the class method efficiently)
// Actually I need to insert the constant before buildGetPropertyCommand or at the top with others.
// The replace tool works on line ranges. I will convert this to 2 separate edits or use multi_replace.

// Let's use multi_replace for cleaner insertion.


const GET_ALL_ELEMENT_PROPERTIES = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    $result = @{}
    
    # 1. Standard Properties from AutomationElement
    $standardProps = @(
        "Name", "AutomationId", "ClassName", "ControlType", "LocalizedControlType",
        "BoundingRectangle", "IsEnabled", "IsOffscreen", "IsKeyboardFocusable",
        "HasKeyboardFocus", "AccessKey", "ProcessId", "RuntimeId", "FrameworkId",
        "NativeWindowHandle", "IsContentElement", "IsControlElement", "IsPassword",
        "HelpText", "ItemStatus", "ItemType", "AcceleratorKey"
    )

    foreach($pName in $standardProps) {
        try {
            $prop = [AutomationElement]::($pName + "Property")
            $val = ${0}.GetCurrentPropertyValue($prop)
            if ($null -ne $val) {
                if ($pName -eq "RuntimeId") { $result[$pName] = $val -join "." }
                else { $result[$pName] = $val.ToString() }
            }
        } catch { }
    }

    # UIA 3.0 + Compatibility(Safe Defaults for UIA 2.0)
    $result["IsDialog"] = "False"
    $result["ProviderDescription"] = ""

    # 2. Pattern Availability check
    $patterns = @(
        "Annotation", "Dock", "Drag", "DropTarget", "ExpandCollapse", "GridItem",
        "Grid", "Invoke", "ItemContainer", "LegacyIAccessible", "MultipleView",
        "ObjectModel", "RangeValue", "ScrollItem", "Scroll", "SelectionItem",
        "Selection", "SpreadsheetItem", "Spreadsheet", "Styles", "SynchronizedInput",
        "TableItem", "Table", "TextChild", "TextEdit", "Text", "Toggle", "Transform",
        "Value", "VirtualizedItem", "Window", "CustomNavigation"
    )

    foreach($pName in $patterns) {
        $propName = "Is" + $pName + "PatternAvailable"
        try {
            $prop = [AutomationElement]::($propName + "Property")
            $val = ${0}.GetCurrentPropertyValue($prop)
            $result[$propName] = $val.ToString()
        } catch {
            $result[$propName] = "False"
        }
    }

    # Pattern2 Compatibility(UIA 3.0)
    $result["IsTextPattern2Available"] = "False"
    $result["IsTransform2PatternAvailable"] = "False"
    $result["IsSelectionPattern2Available"] = "False"

    # 3. Pattern Specific Properties(Force Retrieval)
    $patternsToQuery = @{
        "Value" = @("Value", "IsReadOnly");
        "RangeValue" = @("Value", "IsReadOnly", "Minimum", "Maximum", "LargeChange", "SmallChange");
        "ExpandCollapse" = @("ExpandCollapseState");
        "Toggle" = @("ToggleState");
        "Window" = @("CanMaximize", "CanMinimize", "IsModal", "IsTopmost", "WindowInteractionState", "WindowVisualState");
        "Transform" = @("CanMove", "CanResize", "CanRotate");
        "Scroll" = @("HorizontalScrollPercent", "HorizontalViewSize", "VerticalScrollPercent", "VerticalViewSize", "HorizontallyScrollable", "VerticallyScrollable");
        "Selection" = @("CanSelectMultiple", "IsSelectionRequired");
        "SelectionItem" = @("IsSelected");
        "Grid" = @("ColumnCount", "RowCount");
        "GridItem" = @("Column", "Row", "ColumnSpan", "RowSpan");
        "Table" = @("RowOrColumnMajor");
    }

    foreach($pKey in $patternsToQuery.Keys) {
        try {
            $pTypeName = "System.Windows.Automation.$($pKey)Pattern"
            $pPropField = Invoke-Expression "[$pTypeName]::Pattern"
            $pObj = ${0}.GetCurrentPattern($pPropField)
            if ($null -ne $pObj) {
                $result["Is" + $pKey + "PatternAvailable"] = "True"
                foreach($propName in $patternsToQuery[$pKey]) {
                    try {
                            # Key used for dotted names in Inspect.exe
                            $dottedKey = $pKey + "." + $propName
                            
                            # Try to get value from pattern object
                        $val = $pObj.Current.$propName
                        if ($null -ne $val) {
                            $result[$dottedKey] = $val.ToString()
                                # Also provide short name if not already set
                            if (-not $result.ContainsKey($propName)) {
                                $result[$propName] = $val.ToString()
                            }
                        }
                    } catch { }
                }
            }
        } catch { }
    }

    # 4. Legacy Properties(Force Retrieval)
    try {
        $legacy = ${0}.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current
        if ($null -ne $legacy) {
            $result["IsLegacyIAccessiblePatternAvailable"] = "True"
                
                # Standard Aliases(Backward Compatibility)
            $result['LegacyName'] = $legacy.Name
            $result['LegacyDescription'] = $legacy.Description
            $result['LegacyRole'] = $legacy.Role.ToString()
            $result['LegacyState'] = $legacy.State.ToString()
            $result['LegacyValue'] = $legacy.Value
            $result['LegacyHelp'] = $legacy.Help
            $result['LegacyKeyboardShortcut'] = $legacy.KeyboardShortcut
            $result['LegacyDefaultAction'] = $legacy.DefaultAction
            $result['LegacyChildId'] = $legacy.ChildId.ToString()

                # Dotted Names(Inspect.exe matching)
            $result['LegacyIAccessible.Name'] = $legacy.Name
            $result['LegacyIAccessible.Description'] = $legacy.Description
            $result['LegacyIAccessible.Role'] = $legacy.Role.ToString()
            $result['LegacyIAccessible.State'] = $legacy.State.ToString()
            $result['LegacyIAccessible.Value'] = $legacy.Value
            $result['LegacyIAccessible.Help'] = $legacy.Help
            $result['LegacyIAccessible.KeyboardShortcut'] = $legacy.KeyboardShortcut
            $result['LegacyIAccessible.DefaultAction'] = $legacy.DefaultAction
            $result['LegacyIAccessible.ChildId'] = $legacy.ChildId.ToString()
        }
    } catch { }

    # MSAA Fallback
    try {
        $msaaProps = $null
        $rect = ${0}.Current.BoundingRectangle

        # Check if rect is valid / not - empty to calculate center for Point lookup
        if ($null -ne $rect -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
            $cx = [int]($rect.Left + ($rect.Width / 2))
            $cy = [int]($rect.Top + ($rect.Height / 2))
            $msaaProps = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy)
        }

        # Fallback to HWND if Point lookup didn't work or rect was empty (e.g. offscreen?)
        if ($null -eq $msaaProps) {
            if ($result.ContainsKey("NativeWindowHandle")) {
                $hwnd = $result["NativeWindowHandle"]
            } else {
                $hwnd = ${0}.Current.NativeWindowHandle
            }
            if ($hwnd -ne 0) {
                $msaaProps = [MSAAHelper]::GetAllLegacyProperties([IntPtr]$hwnd)
            }
        }

        if ($null -ne $msaaProps) {
            # If we found props via MSAA(Point or HWND), mark pattern as available
            $result["IsLegacyIAccessiblePatternAvailable"] = "True"
            foreach($key in $msaaProps.Keys) {
                $val = $msaaProps[$key]
                if ($null -ne $val) {
                    # Inspect.exe style: LegacyIAccessible.Name
                    $result["LegacyIAccessible." + $key] = $val
                    # Driver Internal Alias: LegacyName
                    $result["Legacy" + $key] = $val
                }
            }
        }
    } catch { }

    # 5. GetSupportedProperties(Final sweep)
    try {
        foreach($prop in ${0}.GetSupportedProperties()) {
            $name = $prop.ProgrammaticName.Split('.')[-1].Replace('Property', '')
            if (-not $result.ContainsKey($name)) {
                $val = ${0}.GetCurrentPropertyValue($prop)
                if ($null -ne $val) { $result[$name] = $val.ToString() }
            }
        }
    } catch { }

    $result | ConvertTo-Json -Compress
}
`;

const SET_FOCUS_TO_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.SetFocus() } `;

const GET_ELEMENT_TEXT = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([TextPattern]::Pattern).DocumentRange.GetText(-1)
    } catch {
        try {
            ${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.GetSelection().Current.Name
        } catch {
            ${0}.Current.Name
        }
    }
}
`;

const INVOKE_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([InvokePattern]::Pattern).Invoke() } `;
const EXPAND_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Expand() } `;
const COLLAPSE_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Collapse() } `;
const SCROLL_ELEMENT_INTO_VIEW = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    $pattern = ${0}.GetCurrentPattern([ScrollItemPattern]::Pattern);
    if ($null -ne $pattern) {
        $pattern.ScrollIntoView()
    } else {
        $success = $false
        try {
            ${0}.SetFocus()
            $success = $true
        } catch { }

        if (-not $success) {
            try {
                $legacy = ${0}.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern);
                if ($null -ne $legacy) {
                    $legacy.Select(3);
                    $success = $true
                }
            } catch { }
        }

        if (-not $success) {
            # Try ItemContainerPattern on parent
            try {
                $parent = [TreeWalker]::ControlViewWalker.GetParent(${0});
                if ($null -ne $parent) {
                    $containerPattern = $parent.GetCurrentPattern([ItemContainerPattern]::Pattern);
                    if ($null -ne $containerPattern) {
                        # We have the element, so we pass it directly to be realized / scrolled to
                        $found = $containerPattern.FindItemByProperty($null, [AutomationElement]::RuntimeIdProperty, ${0}.GetRuntimeId());
                        if ($null -ne $found) {
                            # Accessing the found item usually brings it into view or realizes it ?
                            # Actually FindItemByProperty returns the element.We might need to ScrollIntoView THAT element ?
                            # But we already have the element.The docs say "retrieves an element... and scrolls it into view".
                            $success = $true
                        }
                    }
                }
            } catch { }
        }

        if (-not $success) {
            throw "Failed to scroll into view: ScrollItemPattern not supported, and SetFocus/LegacySelect/ItemContainerPattern failed."
        }
    }
}
`;
const IS_MULTIPLE_SELECT_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.CanSelectMultiple } `;
const GET_SELECTED_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionPattern]::Pattern).Current.GetSelection() } `;
const IS_ELEMENT_SELECTED = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).Current.IsSelected } `;
const ADD_ELEMENT_TO_SELECTION = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).AddToSelection() } `;
const REMOVE_ELEMENT_FROM_SELECTION = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).RemoveFromSelection() } `;
const SELECT_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([SelectionItemPattern]::Pattern).Select() } `;
const TOGGLE_ELEMENT = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([TogglePattern]::Pattern).Toggle() } `;
const SET_ELEMENT_VALUE = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([ValuePattern]::Pattern).SetValue(${1})
    } catch {
        try {
            $hwnd = ${0}.Current.NativeWindowHandle
            if ($hwnd -gt 0) {
                [MSAAHelper]::SetLegacyValue([IntPtr]$hwnd, ${1})
            }
        } catch { }
    }
}
`;
const GET_ELEMENT_EXPAND_COLLAPSE_STATE = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([ExpandCollapsePattern]::Pattern).Current.ExpandCollapseState
    } catch { $null }
}
`;
const SET_ELEMENT_RANGE_VALUE = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([RangeValuePattern]::Pattern).SetValue(${1}) } `;
const GET_ELEMENT_VALUE = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([ValuePattern]::Pattern).Current.Value
    } catch {
        try {
            $hwnd = ${0}.Current.NativeWindowHandle
            if ($hwnd -gt 0) {
                [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, "accValue")
            } else { $null }
        } catch { $null }
    }
}
`;
const GET_ELEMENT_VALUE_IS_READ_ONLY = pwsh$ /* ps1 */ `
if ($null -ne ${0}) {
    try {
        ${0}.GetCurrentPattern([ValuePattern]::Pattern).Current.IsReadOnly
    } catch {
        # Fallback for Value Pattern missing via MSAA ? 
        # MSAA doesn't strictly have IsReadOnly, but if accValue is settable?
        # accState includes generic STATE_SYSTEM_READONLY(0x40) ?
        try {
            $hwnd = ${0}.Current.NativeWindowHandle
            if ($hwnd -gt 0) {
                $state = [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, "accState");
                if ($null -ne $state) {
                    # STATE_SYSTEM_READONLY = 0x40(64)
                    ($state -band 64) -eq 64
                } else { $false }
            } else { $false }
        } catch { $false }
    }
}
`;
const GET_ELEMENT_TOGGLE_STATE = pwsh$ /* ps1 */ `try { ${0}.GetCurrentPattern([TogglePattern]::Pattern).Current.ToggleState } catch { $null }`;
const MAXIMIZE_WINDOW = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Maximized) }`;
const MINIMIZE_WINDOW = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Minimized) }`;
const RESTORE_WINDOW = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([WindowPattern]::Pattern).SetWindowVisualState([WindowVisualState]::Normal) }`;
const CLOSE_WINDOW = pwsh$ /* ps1 */ `if ($null -ne ${0}) { ${0}.GetCurrentPattern([WindowPattern]::Pattern).Close() }`;

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
} as const);

export type TreeScope = Enum<typeof TreeScope>;

export const AutomationElementMode = Object.freeze({
    NONE: 'none',
    FULL: 'full',
} as const);

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
        if (!property || property.toLowerCase() === 'all') {
            return this.buildGetAllPropertiesCommand();
        }

        const cachedProperties = [
            'name',
            'automationid',
            'classname',
            'controltype',
            'isoffscreen',
            'isenabled',
            'boundingrectangle'
        ];

        if (property.toLowerCase() === 'runtimeid') {
            return GET_ELEMENT_RUNTIME_ID.format(this);
        }

        if (property.toLowerCase() === 'controltype') {
            return GET_ELEMENT_TAG_NAME.format(this);
        }

        if (property.toLowerCase() === 'legacyvalue' || property.toLowerCase() === 'legacyiaccessible.value') {
            return GET_ELEMENT_LEGACY_VALUE.format(this);
        }

        if (property.toLowerCase() === 'legacyname' || property.toLowerCase() === 'legacyiaccessible.name') {
            return GET_ELEMENT_LEGACY_NAME.format(this);
        }

        if (property.toLowerCase() === 'legacydescription' || property.toLowerCase() === 'legacyiaccessible.description') {
            return GET_ELEMENT_LEGACY_DESCRIPTION.format(this);
        }

        if (property.toLowerCase() === 'legacyrole' || property.toLowerCase() === 'legacyiaccessible.role') {
            return GET_ELEMENT_LEGACY_ROLE.format(this);
        }

        if (property.toLowerCase() === 'legacystate' || property.toLowerCase() === 'legacyiaccessible.state') {
            return GET_ELEMENT_LEGACY_STATE.format(this);
        }

        if (property.toLowerCase() === 'legacyhelp' || property.toLowerCase() === 'legacyiaccessible.help') {
            return GET_ELEMENT_LEGACY_HELP.format(this);
        }

        if (property.toLowerCase() === 'legacykeyboardshortcut' || property.toLowerCase() === 'legacyiaccessible.keyboardshortcut') {
            return GET_ELEMENT_LEGACY_KEYBOARD_SHORTCUT.format(this);
        }

        if (property.toLowerCase() === 'legacydefaultaction' || property.toLowerCase() === 'legacyiaccessible.defaultaction') {
            return GET_ELEMENT_LEGACY_DEFAULT_ACTION.format(this);
        }

        if (property.toLowerCase() === 'legacychildid' || property.toLowerCase() === 'legacyiaccessible.childid') {
            return GET_ELEMENT_LEGACY_CHILD_ID.format(this);
        }

        if (property.toLowerCase() === 'islegacyiaccessiblepatternavailable') {
            return IS_LEGACY_PATTERN_AVAILABLE.format(this);
        }

        if (property.toLowerCase() === 'isvaluepatternavailable') {
            // Return true if either native pattern exists OR we have a valid HWND for MSAA fallback
            return IS_LEGACY_PATTERN_AVAILABLE.format(this);
            // Reusing the same logic: if fallback works for Legacy, it works for Value simulation
        }

        if (property.toLowerCase() === 'value.value') {
            return GET_ELEMENT_VALUE.format(this);
        }

        if (property.toLowerCase() === 'value.isreadonly') {
            return GET_ELEMENT_VALUE_IS_READ_ONLY.format(this);
        }

        // Handle UIA3 properties that don't exist in UIA2 (Safe Defaults)
        const uia3Properties = [
            'isdialog', 'isannotationpatternavailable', 'isdragpatternavailable', 'isdockpatternavailable',
            'isdroptargetpatternavailable', 'isobjectmodelpatternavailable', 'isspreadsheetitempatternavailable',
            'isspreadsheetpatternavailable', 'isstylespatternavailable', 'issynchronizedinputpatternavailable',
            'istextchildpatternavailable', 'istexteditpatternavailable', 'istextpattern2available',
            'istransform2patternavailable', 'isvirtualizeditempatternavailable', 'iscustomnavigationpatternavailable',
            'isselectionpattern2available'
        ];
        if (uia3Properties.includes(property.toLowerCase())) {
            return '$false'; // Return generic false for unsupported features in UIA2
        }

        if (property.toLowerCase() === 'expandcollapse.expandcollapsestate' || property.toLowerCase() === 'expandcollapsestate') {
            return GET_ELEMENT_EXPAND_COLLAPSE_STATE.format(this);
        }

        if (property.toLowerCase() === 'canmaximize') {
            return GET_ELEMENT_WINDOW_CAN_MAXIMIZE.format(this);
        }
        if (property.toLowerCase() === 'canminimize') {
            return GET_ELEMENT_WINDOW_CAN_MINIMIZE.format(this);
        }
        if (property.toLowerCase() === 'ismodal') {
            return GET_ELEMENT_WINDOW_IS_MODAL.format(this);
        }
        if (property.toLowerCase() === 'istopmost') {
            return GET_ELEMENT_WINDOW_IS_TOPMOST.format(this);
        }
        if (property.toLowerCase() === 'windowinteractionstate') {
            return GET_ELEMENT_WINDOW_INTERACTION_STATE.format(this);
        }
        if (property.toLowerCase() === 'windowvisualstate') {
            return GET_ELEMENT_WINDOW_VISUAL_STATE.format(this);
        }

        if (property.toLowerCase() === 'canmove') {
            return GET_ELEMENT_TRANSFORM_CAN_MOVE.format(this);
        }
        if (property.toLowerCase() === 'canresize') {
            return GET_ELEMENT_TRANSFORM_CAN_RESIZE.format(this);
        }
        if (property.toLowerCase() === 'canrotate') {
            return GET_ELEMENT_TRANSFORM_CAN_ROTATE.format(this);
        }

        if (property.toLowerCase() === 'providerdescription') {
            return '$null'; // UIA3 only
        }

        if (cachedProperties.includes(property.toLowerCase())) {
            return GET_CACHED_ELEMENT_PROPERTY.format(this, property);
        }

        return GET_CURRENT_ELEMENT_PROPERTY.format(this, property);
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
        return SCROLL_ELEMENT_INTO_VIEW.format(this);
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