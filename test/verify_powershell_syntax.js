
const { spawn } = require('child_process');

function normalize(command) {
    // Mimic the new logic in core.ts
    // Remove comments
    command = command.replace(/<#[\s\S]*?#>/g, ''); // Block comments
    command = command.replace(/(#.*$)/gm, ''); // Line comments
    // Normalize whitespace
    return command.replace(/\s+/g, ' ').trim();
}

async function verifySyntax(name, script) {
    // Replace valid placeholders that might cause parse errors if not valid variables
    // ${0}, ${1} -> $null
    const interpolated = script.replace(/\$\{\d+\}/g, '$null');
    const minified = normalize(interpolated);

    // We wrap in a scriptblock creation to test parsing. 
    // We escape single quotes for the PowerShell string literal.
    const escaped = minified.replace(/'/g, "''");
    const psCommand = `
        try {
            $sb = [ScriptBlock]::Create('${escaped}');
            Write-Host "OK"
        } catch {
            Write-Host "ERROR: $_"
            Write-Host "DEBUG_CODE: ${escaped}"
        }
    `;

    return new Promise((resolve) => {
        const ps = spawn('pwsh', ['-Command', '-']);
        let output = '';

        ps.stdin.write(psCommand);
        ps.stdin.end();

        ps.stdout.on('data', (data) => output += data.toString());
        ps.stderr.on('data', (data) => output += data.toString());

        ps.on('close', (code) => {
            if (output.trim().includes('OK')) {
                console.log(`[PASS] ${name}`);
                resolve(true);
            } else {
                console.error(`[FAIL] ${name}`);
                console.error(output);
                resolve(false);
            }
        });
    });
}

const SET_ELEMENT_VALUE = `
    try {
        \${0}.GetCurrentPattern([ValuePattern]::Pattern).SetValue(\${1});
    } catch { } 
    
    # try {
    #     $hwnd = $_.Current.NativeWindowHandle
    #     if ($hwnd -gt 0) {
    #         [MSAAHelper]::SetLegacyValue([IntPtr]$hwnd, \${1})
    #     }
    # } catch { }
`;

const GET_ELEMENT_VALUE = `
    try {
        return \${0}.GetCurrentPattern([ValuePattern]::Pattern).Current.Value;
    } catch { }

    # try {
    #     $hwnd = $_.Current.NativeWindowHandle
    #     if ($hwnd -gt 0) {
    #         return [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, "accValue")
    #     } 
    #     
    #     return $null
    # } catch { return $null; }
`;

const GET_LEGACY_PROPERTY_SAFE = `
    function Get-LegacyPropertySafe {
        param (
            [Parameter(Mandatory=$false)]
            [AutomationElement]$element,
            [string]$propName,
            [string]$accPropName
        );

        if ($null -eq $element) { return $null };

        $val = $null;
        try {
            $val = $element.GetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern).Current.$propName;
        } catch {};

        if ($null -ne $val) { return $val };

        try {
            $rect = $element.Current.BoundingRectangle;
            if ($null -ne $rect -and $rect.Width -gt 0) {
                $cx = [int]($rect.Left + $rect.Width/2);
                $cy = [int]($rect.Top + $rect.Height/2);
                $props = [MSAAHelper]::GetLegacyPropsFromPoint($cx, $cy);
                if ($null -ne $props) { return $props[$propName] };
            }
        } catch {};

        try {
            $hwnd = $element.Current.NativeWindowHandle;
            if ($hwnd -gt 0) {
                return [MSAAHelper]::GetLegacyProperty([IntPtr]$hwnd, $accPropName);
            }
        } catch {};

        return $null;
    }
`;

const FIND_CHILDREN_RECURSIVELY = `
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

const PAGE_SOURCE = `
    function Get-PageSource {
        param (
            [Parameter(Mandatory = $true)]
            [AutomationElement]$element,
            [Xml.XmlDocument]$xmlDoc,
            [Xml.XmlElement]$xmlElement
        );

        try {
            $localizedControlType = $element.GetCurrentPropertyValue([AutomationElement]::LocalizedControlTypeProperty);
            $controlType = $element.GetCurrentPropertyValue([AutomationElement]::ControlTypeProperty);

            $tagName = '';
            try {
                $tagName = $controlType.ProgrammaticName.Split('.')[-1];
            } catch {
                # fallback to LocalizedControlType ControlType is empty
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

            if ($null -eq $xmlDoc) { $xmlDoc = [Xml.XmlDocument]::new() };

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

            if ($null -eq $xmlElement) {
                $xmlElement = $xmlDoc.AppendChild($newXmlElement);
            } else {
                $xmlElement = $xmlElement.AppendChild($newXmlElement);
            }

            $elementsToProcess = New-Object System.Collections.Queue;
            $element.FindAll([TreeScope]::Children, $cacheRequest.TreeFilter) | ForEach-Object {
                $elementsToProcess.Enqueue($_);
            };

            while ($elementsToProcess.Count -gt 0) {
                $currentElement = $elementsToProcess.Dequeue();
                Get-PageSource $currentElement $xmlDoc $xmlElement | Out-Null;
            }
        } catch {
            # noop
        }

        return $xmlElement;
    }
`;

const GET_PAGE_SOURCE_COMMAND = `
    $el = \${0};

    if ($el -eq $null) {
        $el = [AutomationElement]::RootElement;
    }

    $source = Get-PageSource $el;
    if ($null -ne $source) {
        $source.OuterXml;
    } else {
        # Final fallback if even Get-PageSource fails for some reason
        '<DummyRoot />';
    }
`;

const GET_ELEMENT_SCREENSHOT = `
    try {
        $el = \${0};
        $rect = $el.Current.BoundingRectangle;

        if ($el -eq $null -or $rect.Width -le 0 -or $rect.Height -le 0) {
            # Return 1x1 placeholder
            $bitmap = New-Object Drawing.Bitmap 1,1;
            $stream = New-Object IO.MemoryStream;
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
            $bitmap.Dispose();
            return [Convert]::ToBase64String($stream.ToArray());
        }

        $bitmap = New-Object Drawing.Bitmap([int32]$rect.Width, [int32]$rect.Height);
        $graphics = [Drawing.Graphics]::FromImage($bitmap);

        try {
            # 0,0 is destination X,Y in the bitmap
            $graphics.CopyFromScreen([int32]$rect.Left, [int32]$rect.Top, 0, 0, $bitmap.Size);
        } catch {
            # UAC or other failure
            $graphics.Clear([Drawing.Color]::Red);
        }

        $graphics.Dispose();

        $stream = New-Object IO.MemoryStream;
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
        $bitmap.Dispose();
        [Convert]::ToBase64String($stream.ToArray());
    } catch {
        # Global fallback
        $bitmap = New-Object Drawing.Bitmap 1,1;
        $stream = New-Object IO.MemoryStream;
        $graphics = [Drawing.Graphics]::FromImage($bitmap);
        $graphics.Clear([Drawing.Color]::Red);
        $graphics.Dispose();
        $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png);
        $bitmap.Dispose();
        [Convert]::ToBase64String($stream.ToArray());
    }
`;

const GET_IMAGE_CLIPBOARD_BASE64 = `
    [Windows.Clipboard]::GetImage() | ForEach-Object {
            if ($_ -ne $null) {
            $stream = New-Object IO.MemoryStream;
            $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder;
            $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($_));
            $encoder.Save($stream);
            $stream.Position = 0;
            $bytes = $stream.ToArray();
            $base64String = [Convert]::ToBase64String($bytes);
            $stream.Close();
            Write-Output $base64String;
        }
    }
`;

async function runTests() {
    let success = true;
    success &= await verifySyntax('SET_ELEMENT_VALUE', SET_ELEMENT_VALUE);
    success &= await verifySyntax('GET_ELEMENT_VALUE', GET_ELEMENT_VALUE);
    success &= await verifySyntax('GET_LEGACY_PROPERTY_SAFE', GET_LEGACY_PROPERTY_SAFE);
    success &= await verifySyntax('FIND_CHILDREN_RECURSIVELY', FIND_CHILDREN_RECURSIVELY);
    success &= await verifySyntax('PAGE_SOURCE', PAGE_SOURCE);
    success &= await verifySyntax('GET_PAGE_SOURCE_COMMAND', GET_PAGE_SOURCE_COMMAND);

    success &= await verifySyntax('GET_ELEMENT_SCREENSHOT', GET_ELEMENT_SCREENSHOT);
    success &= await verifySyntax('GET_IMAGE_CLIPBOARD_BASE64', GET_IMAGE_CLIPBOARD_BASE64);

    if (success) {
        console.log('All PowerShell syntax checks PASSED.');
        process.exit(0);
    } else {
        console.error('Some PowerShell syntax checks FAILED.');
        process.exit(1);
    }
}

runTests();
