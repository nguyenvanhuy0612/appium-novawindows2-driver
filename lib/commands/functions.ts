import { pwsh } from '../powershell';

export const GET_LEGACY_PROPERTY_SAFE = pwsh /* ps1 */ `
    function Get-LegacyPropertySafe {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [string]$propName,
            [string]$accPropName
        );

        if ($null -eq $element) { return $null };

        # 1. Try PowerShell: UIA LegacyIAccessiblePattern
        try {
            $val = $element.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current.$propName;
            if ($null -ne $val) { return $val };
        } catch {};

        # 2. Try C#: Win32 MSAA with PID validation
        try {
            $hwnd = 0; try { $hwnd = [int]$element.Current.NativeWindowHandle; } catch { }
            $rect = $element.Current.BoundingRectangle;
            $cx = 0; $cy = 0;
            try { $cx = [int]($rect.Left + $rect.Width / 2); $cy = [int]($rect.Top + $rect.Height / 2); } catch { }
            try { [Win32Helper]::SetExpectedPid([uint32]$element.Current.ProcessId); } catch { }
            return [Win32Helper]::GetLegacyPropertyWithFallback([IntPtr]$hwnd, $cx, $cy, $accPropName);
        } catch {};

        return $null;
    }
`;

export const FIND_DESCENDANTS_FUNCTIONS = pwsh /* ps1 */ `
    # Streaming, memory-bounded subtree walk used as the safe fallback for
    # Find-AllDescendants when the fast-path FindAll(Subtree) would either
    # OutOfMemoryException (observed on desktop-rooted sessions: UIA's
    # FindAll on a large tree materialises too much intermediate state) or
    # take pathologically long.
    #
    # Iterative DFS via TreeWalker. At any moment, only a stack-depth's
    # worth of AutomationElement references + the matches list is in memory
    # - not the entire visited set. Each element is filter-tested
    # individually via FindFirst([Element], $condition), which is O(1) in
    # the size of the subtree.
    #
    # The walker respects the active $cacheRequest's TreeFilter (same as
    # the upstream walker behaviour FindAll uses), so excluded views (e.g.
    # Chrome content) stay excluded.
    function Find-AllDescendantsStreaming {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [Parameter(Mandatory=$false)]
            [Condition]$condition,
            [switch]$includeSelf
        );

        if ($null -eq $element -or $null -eq $condition) { return @() };

        $walker = [TreeWalker]::new($cacheRequest.TreeFilter);
        $matches = New-Object System.Collections.Generic.List[AutomationElement];

        if ($includeSelf) {
            try {
                $selfMatch = $element.FindFirst([TreeScope]::Element, $condition);
                if ($null -ne $selfMatch) { $matches.Add($selfMatch); }
            } catch { }
        }

        $stack = New-Object System.Collections.Generic.Stack[AutomationElement];
        try {
            $first = $walker.GetFirstChild($element);
            if ($null -ne $first) { $stack.Push($first); }
        } catch { }

        while ($stack.Count -gt 0) {
            $current = $stack.Pop();
            try {
                if ($null -ne $current.FindFirst([TreeScope]::Element, $condition)) {
                    $matches.Add($current);
                }
                $sibling = $walker.GetNextSibling($current);
                if ($null -ne $sibling) { $stack.Push($sibling); }
                $firstChild = $walker.GetFirstChild($current);
                if ($null -ne $firstChild) { $stack.Push($firstChild); }
            } catch {
                # Dead element / COM disconnect / property fetch failed.
                # Skip it and keep walking - a single bad node shouldn't
                # abort the entire search.
                continue;
            }
        }

        return $matches;
    }

    function Find-Descendant {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [Parameter(Mandatory=$false)]
            [Condition]$condition,
            [switch]$includeSelf
        );

        if ($null -eq $element -or $null -eq $condition) { return $null };

        $scope = if ($includeSelf) { [TreeScope]::Subtree } else { [TreeScope]::Descendants };
        return $element.FindFirst($scope, $condition);
    }

    function Find-AllDescendants {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [Parameter(Mandatory=$false)]
            [Condition]$condition,
            [switch]$includeSelf
        );

        if ($null -eq $element -or $null -eq $condition) { return @() };

        # Fast vs safe path selection.
        #
        # The built-in UIA FindAll([TreeScope]::Subtree, ...) is dramatically
        # faster than walking with TreeWalker for bounded subtrees, but on
        # the desktop root it materialises so much intermediate state that
        # it throws System.OutOfMemoryException on busy hosts. That kills
        # the PowerShell subprocess and (under memory pressure) can cascade
        # into Appium's Node.js process being killed by the Windows OOM
        # handler.
        #
        # Route any search starting at [AutomationElement]::RootElement
        # through the streaming walker. All other (window-scoped) searches
        # keep the fast path.
        $isDesktopRoot = $false;
        try {
            $isDesktopRoot = [object]::ReferenceEquals($element, [AutomationElement]::RootElement) -or $element.Equals([AutomationElement]::RootElement);
        } catch { }

        if ($isDesktopRoot) {
            return Find-AllDescendantsStreaming -element $element -condition $condition -includeSelf:$includeSelf;
        }

        $scope = if ($includeSelf) { [TreeScope]::Subtree } else { [TreeScope]::Descendants };
        try {
            return $element.FindAll($scope, $condition);
        } catch [System.OutOfMemoryException] {
            # Defence in depth: if FindAll OOMs on a non-root scope (huge
            # Edge window with many tabs, complex dashboards, etc.), fall
            # back to streaming. Note CLR OOM isn't always catchable; this
            # is best-effort.
            return Find-AllDescendantsStreaming -element $element -condition $condition -includeSelf:$includeSelf;
        }
    }
`;

export const FIND_CHILDREN_RECURSIVELY = pwsh /* ps1 */ `
    function Find-ChildrenRecursively {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [Parameter(Mandatory=$false)]
            [Condition]$condition,
            [Parameter(Mandatory=$false)]
            [bool]$includeSelf = $false
        );

        if ($null -eq $element -or $null -eq $condition) { return $null };

        $scope = if ($includeSelf) {
            [TreeScope]::Element -bor [TreeScope]::Children;
        } else {
            [TreeScope]::Children;
        };

        $validChild = $element.FindFirst($scope, $condition);

        if ($validChild -ne $null) {
            return $validChild;
        }

        $children = $element.FindAll([TreeScope]::Children, [Condition]::TrueCondition);
        foreach ($child in $children) {
            $result = Find-AllChildrenRecursively -element $child -condition $condition -returnFirstResult $true;
            if ($result -ne $null) {
                return $result[0];
            }
        }

        return $null;
    }

    function Find-AllChildrenRecursively {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [Parameter(Mandatory=$false)]
            [Condition]$condition,
            [bool]$returnFirstResult = $false,
            [Parameter(Mandatory=$false)]
            [bool]$includeSelf = $false
        );

        if ($null -eq $element -or $null -eq $condition) { return @() };

        $children = $element.FindAll([TreeScope]::Children, [Condition]::TrueCondition);
        $validChildren = @($children | Where-Object { $_.FindFirst([TreeScope]::Element, $condition) -ne $null });

        if ($includeSelf) {
            $self = $element.FindFirst([TreeScope]::Element, $condition);
        }

        if ($null -ne $self) {
            $validChildren += $self;
        }

        foreach ($child in $children) {
            $Allresults = Find-AllChildrenRecursively -element $child -condition $condition;
            if ($returnFirstResult -and $Allresults.Count -gt 0) {
                return $Allresults;
            }

            foreach ($result in $Allresults) {
                $validChildren += ($result | Where-Object { $_.FindFirst([TreeScope]::Element, $condition) -ne $null });
            }
        }

        return $validChildren;
    }
`;

export const PAGE_SOURCE = pwsh /* ps1 */ `
    # Builds the XML node for a single AutomationElement (no traversal).
    # Pulled out of Get-PageSource so the iterative walker below can call it
    # per node without each call adding a PS stack frame.
    function Build-PageSourceNode {
        param (
            [Parameter(Mandatory = $true)]
            [AutomationElement]$element,
            [Parameter(Mandatory = $true)]
            [Xml.XmlDocument]$xmlDoc
        );

        $localizedControlType = $element.GetCurrentPropertyValue([AutomationElement]::LocalizedControlTypeProperty);
        $controlType = $element.GetCurrentPropertyValue([AutomationElement]::ControlTypeProperty);

        $tagName = '';
        try {
            $tagName = $controlType.ProgrammaticName.Split('.')[-1];
        } catch {
            # fallback to LocalizedControlType if ControlType is empty
            $tagName = -join ($localizedControlType -split ' ' | ForEach-Object {
                $_.Substring(0, 1).ToUpper() + $_.Substring(1).ToLower();
            });
        }
        if ($tagName -eq 'DataGrid') { $tagName = 'List' }
        elseif ($tagName -eq 'DataItem') { $tagName = 'ListItem' };

        $acceleratorKey = $element.GetCurrentPropertyValue([AutomationElement]::AcceleratorKeyProperty);
        $accessKey = $element.GetCurrentPropertyValue([AutomationElement]::AccessKeyProperty);
        $automationId = $element.GetCurrentPropertyValue([AutomationElement]::AutomationIdProperty);
        $className = $element.GetCurrentPropertyValue([AutomationElement]::ClassNameProperty);
        $frameworkId = $element.GetCurrentPropertyValue([AutomationElement]::FrameworkIdProperty);
        $hasKeyboardfocus = $element.GetCurrentPropertyValue([AutomationElement]::HasKeyboardfocusProperty);
        $helpText = $element.GetCurrentPropertyValue([AutomationElement]::HelpTextProperty);
        $isContentelement = $element.GetCurrentPropertyValue([AutomationElement]::IsContentelementProperty);
        $isControlelement = $element.GetCurrentPropertyValue([AutomationElement]::IsControlelementProperty);
        $isEnabled = $element.GetCurrentPropertyValue([AutomationElement]::IsEnabledProperty);
        $isKeyboardfocusable = $element.GetCurrentPropertyValue([AutomationElement]::IsKeyboardfocusableProperty);
        $isOffscreen = $element.GetCurrentPropertyValue([AutomationElement]::IsOffscreenProperty);
        $isPassword = $element.GetCurrentPropertyValue([AutomationElement]::IsPasswordProperty);
        $isRequiredforform = $element.GetCurrentPropertyValue([AutomationElement]::IsRequiredforformProperty);
        $itemStatus = $element.GetCurrentPropertyValue([AutomationElement]::ItemStatusProperty);
        $itemType = $element.GetCurrentPropertyValue([AutomationElement]::ItemTypeProperty);
        $name = $element.GetCurrentPropertyValue([AutomationElement]::NameProperty);
        $orientation = $element.GetCurrentPropertyValue([AutomationElement]::OrientationProperty);
        $processId = $element.GetCurrentPropertyValue([AutomationElement]::ProcessIdProperty);
        $runtimeId = $element.GetCurrentPropertyValue([AutomationElement]::RuntimeIdProperty) -join '.';
        $boundingRectangle = $element.Current.BoundingRectangle;
        $x = $boundingRectangle.X - $rootElement.Current.BoundingRectangle.X;
        $y = $boundingRectangle.Y - $rootElement.Current.BoundingRectangle.Y;
        $width = $boundingRectangle.Width;
        $height = $boundingRectangle.Height;

        $newXmlElement = $xmlDoc.CreateElement($tagName);
        $newXmlElement.SetAttribute("AcceleratorKey", $acceleratorKey);
        $newXmlElement.SetAttribute("AccessKey", $accessKey);
        $newXmlElement.SetAttribute("AutomationId", $automationId);
        $newXmlElement.SetAttribute("ClassName", $className);
        $newXmlElement.SetAttribute("FrameworkId", $frameworkId);
        $newXmlElement.SetAttribute("HasKeyboardfocus", $hasKeyboardfocus);
        $newXmlElement.SetAttribute("HelpText", $helpText);
        $newXmlElement.SetAttribute("IsContentelement", $isContentelement);
        $newXmlElement.SetAttribute("IsControlelement", $isControlelement);
        $newXmlElement.SetAttribute("IsEnabled", $isEnabled);
        $newXmlElement.SetAttribute("IsKeyboardfocusable", $isKeyboardfocusable);
        $newXmlElement.SetAttribute("IsOffscreen", $isOffscreen);
        $newXmlElement.SetAttribute("IsPassword", $isPassword);
        $newXmlElement.SetAttribute("IsRequiredforform", $isRequiredforform);
        $newXmlElement.SetAttribute("ItemStatus", $itemStatus);
        $newXmlElement.SetAttribute("ItemType", $itemType);
        $newXmlElement.SetAttribute("LocalizedControlType", $localizedControlType);
        $newXmlElement.SetAttribute("Name", $name);
        $newXmlElement.SetAttribute("Orientation", $orientation);
        $newXmlElement.SetAttribute("ProcessId", $processId);
        $newXmlElement.SetAttribute("RuntimeId", $runtimeId);
        $newXmlElement.SetAttribute("x", $x);
        $newXmlElement.SetAttribute("y", $y);
        $newXmlElement.SetAttribute("width", $width);
        $newXmlElement.SetAttribute("height", $height);

        $pattern = $null;
        if ($element.TryGetCurrentPattern([WindowPattern]::Pattern, [ref]$pattern)) {
            $newXmlElement.SetAttribute("CanMaximize", $pattern.Current.CanMaximize);
            $newXmlElement.SetAttribute("CanMinimize", $pattern.Current.CanMinimize);
            $newXmlElement.SetAttribute("IsModal", $pattern.Current.IsModal);
            $newXmlElement.SetAttribute("WindowVisualState", $pattern.Current.WindowVisualState);
            $newXmlElement.SetAttribute("WindowInteractionState", $pattern.Current.WindowInteractionState);
            $newXmlElement.SetAttribute("IsTopmost", $pattern.Current.IsTopmost);
        }
        if ($element.TryGetCurrentPattern([TransformPattern]::Pattern, [ref]$pattern)) {
            $newXmlElement.SetAttribute("CanRotate", $pattern.Current.CanRotate);
            $newXmlElement.SetAttribute("CanResize", $pattern.Current.CanResize);
            $newXmlElement.SetAttribute("CanMove", $pattern.Current.CanMove);
        }

        # TODO: more to be added depending on the available patterns

        return $newXmlElement;
    }

    # Iterative BFS over the UIA subtree, producing the same XML output as
    # the previous recursive Get-PageSource. The recursive version blew the
    # PS function-call stack on deep desktop-rooted trees, which crashed the
    # PS subprocess (~5000-frame ceiling). The iterative version keeps stack
    # depth at O(1) regardless of tree depth; memory at any moment is bounded
    # by the queue size (siblings still to visit), not by tree depth.
    #
    # Public signature unchanged so callers don't break:
    #   Get-PageSource $element                   - new document, return root XML element
    #   Get-PageSource $element $xmlDoc $xmlElement - append under $xmlElement (legacy)
    function Get-PageSource {
        param (
            [Parameter(Mandatory = $true)]
            [AutomationElement]$element,
            [Xml.XmlDocument]$xmlDoc,
            [Xml.XmlElement]$xmlElement
        );

        if ($null -eq $xmlDoc) { $xmlDoc = [Xml.XmlDocument]::new() };

        # Queue of (element, parentXmlElementOrNull). parentXmlElement = $null
        # for the seed entry means "append to xmlDoc directly".
        $queue = New-Object System.Collections.Queue;
        $queue.Enqueue(@($element, $xmlElement));

        $resultXmlElement = $null;

        while ($queue.Count -gt 0) {
            $pair = $queue.Dequeue();
            $curElement = $pair[0];
            $curParent = $pair[1];

            try {
                $newXmlElement = Build-PageSourceNode -element $curElement -xmlDoc $xmlDoc;

                if ($null -eq $curParent) {
                    $appended = $xmlDoc.AppendChild($newXmlElement);
                } else {
                    $appended = $curParent.AppendChild($newXmlElement);
                }

                if ($null -eq $resultXmlElement) { $resultXmlElement = $appended };

                # Enqueue children with the freshly-appended node as their parent.
                $curElement.FindAll([TreeScope]::Children, $cacheRequest.TreeFilter) | ForEach-Object {
                    $queue.Enqueue(@($_, $appended));
                };
            } catch {
                # Skip this node and keep walking the rest of the tree.
                continue;
            }
        }

        return $resultXmlElement;
    }
`;