import path from 'node:path';

const dllPath = path.resolve(__dirname, '..', 'dll', 'UIAHelper.dll').replace(/\\/g, '\\\\');
const dllDir = path.resolve(__dirname, '..', 'dll').replace(/\\/g, '\\\\');

export const UIA_HELPER_SCRIPT = /* ps1 */ `
# UIA Helper - Self-contained script that compiles and loads the helper

$dllPath = '${dllPath}'
$dllDir = '${dllDir}'

# Check if UIAHelper is already loaded
if (-not ([System.Management.Automation.PSTypeName]'UIAHelper').Type) {

    # Check if DLL exists
    if (Test-Path $dllPath) {
        # Check if the DLL is locked or in use, strictly speaking we should check file hash/version
        # but for now simpler check. If we need to force update, delete the DLL manually or logic here.
        Write-Output "Loading UIAHelper from existing DLL: $dllPath"
        try {
            Add-Type -Path $dllPath -ErrorAction Stop
        } catch {
             Write-Output "Failed to load existing DLL, might be incompatible or locked. Recompiling..."
             Remove-Item -Path $dllPath -Force -ErrorAction SilentlyContinue
        }
    }
    
    # If still not loaded (compiled above failed or didn't exist)
    if (-not ([System.Management.Automation.PSTypeName]'UIAHelper').Type) {
        Write-Output "Compiling UIAHelper.dll..."

        # Create DLL directory if it doesn't exist
        if (-not (Test-Path $dllDir)) {
            New-Item -ItemType Directory -Path $dllDir -Force | Out-Null
        }

        # C# source code
        $code = @'
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Windows.Automation;
using System.Text;
using System.Xml;

public static class UIAHelper {

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static string Hello() {
        return "Hello from UIAHelper DLL! (Version 2)";
    }

    public static AutomationElement FindElement(AutomationElement root, Condition condition, TreeScope scope) {
        if (root == null || condition == null) return null;
        return root.FindFirst(scope, condition);
    }

    public static AutomationElementCollection FindAll(AutomationElement root, Condition condition, TreeScope scope) {
        if (root == null || condition == null) return null;
        return root.FindAll(scope, condition);
    }
    
    // Helper to get ClassName from a Condition if it exists (for Win32 fallback optimization)
    private static string GetClassNameFromCondition(Condition condition) {
        PropertyCondition pc = condition as PropertyCondition;
        if (pc != null && pc.Property == AutomationElement.ClassNameProperty) {
            return pc.Value as string;
        }
        
        AndCondition ac = condition as AndCondition;
        if (ac != null) {
            foreach (var sub in ac.GetConditions()) {
                string res = GetClassNameFromCondition(sub);
                if (!string.IsNullOrEmpty(res)) return res;
            }
        }
        return null;
    }

    // Win32 Helper methods
    public static List<IntPtr> GetTopLevelWindows() {
        List<IntPtr> windows = new List<IntPtr>();
        EnumWindows(delegate(IntPtr wnd, IntPtr param) {
            windows.Add(wnd);
            return true;
        }, IntPtr.Zero);
        return windows;
    }

    public static List<IntPtr> GetChildWindows(IntPtr parent) {
        List<IntPtr> windows = new List<IntPtr>();
        EnumChildWindows(parent, delegate(IntPtr wnd, IntPtr param) {
            windows.Add(wnd);
            return true;
        }, IntPtr.Zero);
        return windows;
    }

    public static AutomationElement FindDescendantDebug(AutomationElement root, Condition condition, TreeScope scope) {
        if (root == null || condition == null) return null;

        // 1. Standard UIA Search
        AutomationElement found = root.FindFirst(scope, condition);
        if (found != null) return found;

        // 2. Win32 Fallback
        IntPtr baseHwnd = IntPtr.Zero;
        try {
            if (root != AutomationElement.RootElement) {
                baseHwnd = new IntPtr(root.Current.NativeWindowHandle);
            }
        } catch { }

        // Optimization: Check ClassName AND Name for Win32 lookup
        string targetClass = GetClassNameFromCondition(condition);
        string targetName = GetNameFromCondition(condition);
        
        // SPECIAL CASE: Start Button
        if (targetName == "Start" || targetClass == "Start") {
            IntPtr trayHwnd = FindWindow("Shell_TrayWnd", null);
            if (trayHwnd != IntPtr.Zero) {
                 AutomationElement trayEl = AutomationElement.FromHandle(trayHwnd);
                 if (trayEl != null) {
                     AutomationElement startBtn = trayEl.FindFirst(TreeScope.Descendants, condition);
                     if (startBtn != null) return startBtn;
                 }
            }
            
            // Secondary taskbars
             IntPtr secondTrayHwnd = FindWindow("Shell_SecondaryTrayWnd", null);
             if (secondTrayHwnd != IntPtr.Zero) {
                 AutomationElement trayEl = AutomationElement.FromHandle(secondTrayHwnd);
                 if (trayEl != null) {
                     AutomationElement startBtn = trayEl.FindFirst(TreeScope.Descendants, condition);
                     if (startBtn != null) return startBtn;
                 }
             }
        }

        if (!string.IsNullOrEmpty(targetClass) || !string.IsNullOrEmpty(targetName)) {
            IntPtr h = (baseHwnd == IntPtr.Zero) 
                ? FindWindow(targetClass, targetName) 
                : FindWindowEx(baseHwnd, IntPtr.Zero, targetClass, targetName);
            
            if (h != IntPtr.Zero) {
                try {
                    AutomationElement el = AutomationElement.FromHandle(h);
                    if (el != null && el.FindFirst(TreeScope.Element, condition) != null) {
                        return el;
                    }
                } catch { }
            }
        }

        // Full Search Fallback
        if ((scope & (TreeScope.Descendants | TreeScope.Children | TreeScope.Subtree)) != 0) {
            List<IntPtr> candidates = (baseHwnd == IntPtr.Zero) 
                ? GetTopLevelWindows() 
                : GetChildWindows(baseHwnd);
            
            foreach (IntPtr hwnd in candidates) {
                try {
                    // optimization: Check Win32 WindowText if targetName is specified
                    if (!string.IsNullOrEmpty(targetName)) {
                        StringBuilder sb = new StringBuilder(256);
                        GetWindowText(hwnd, sb, sb.Capacity);
                        if (sb.ToString() == targetName) {
                             AutomationElement matchEl = AutomationElement.FromHandle(hwnd);
                             if (matchEl != null) return matchEl;
                        }
                    }

                    AutomationElement el = AutomationElement.FromHandle(hwnd);
                    if (el != null) {
                        if (el.FindFirst(TreeScope.Element, condition) != null) return el;
                        if ((scope & (TreeScope.Descendants | TreeScope.Subtree)) != 0) {
                            AutomationElement childMatch = el.FindFirst(TreeScope.Subtree, condition);
                            if (childMatch != null) return childMatch;
                        }
                    }
                } catch { }
            }
        }

        return null;
    }


    private static string GetNameFromCondition(Condition condition) {
        PropertyCondition pc = condition as PropertyCondition;
        if (pc != null && pc.Property == AutomationElement.NameProperty) {
            return pc.Value as string;
        }
        
        AndCondition ac = condition as AndCondition;
        if (ac != null) {
            foreach (var sub in ac.GetConditions()) {
                string res = GetNameFromCondition(sub);
                if (!string.IsNullOrEmpty(res)) return res;
            }
        }
        return null;
    }
    private static void AddUnique(List<AutomationElement> list, HashSet<string> seen, AutomationElement el) {
         if (el == null) return;
         try {
            int[] rid = el.GetRuntimeId();
            string idStr = string.Join(".", rid);
            if (!seen.Contains(idStr)) {
                seen.Add(idStr);
                list.Add(el);
            }
         } catch { }
    }

    public static List<AutomationElement> FindAllDescendants(AutomationElement root, Condition condition, TreeScope scope) {
        List<AutomationElement> results = new List<AutomationElement>();
        HashSet<string> seenIds = new HashSet<string>();

        if (root == null || condition == null) return results;

        // 1. Standard Search
        AutomationElementCollection initialMatches = root.FindAll(scope, condition);
        foreach (AutomationElement el in initialMatches) {
            AddUnique(results, seenIds, el);
        }
        
        // 1b. Fallback: If Descendants returned nothing, try Subtree
        // Subtree includes the element itself, which Descendants excludes
        if (results.Count == 0 && scope == TreeScope.Descendants) {
            AutomationElementCollection subtreeMatches = root.FindAll(TreeScope.Subtree, condition);
            foreach (AutomationElement el in subtreeMatches) {
                AddUnique(results, seenIds, el);
            }
        }

        // 2. Win32 Fallback
        if (results.Count == 0 && (scope & (TreeScope.Descendants | TreeScope.Children | TreeScope.Subtree)) != 0) {
            
            IntPtr baseHwnd = IntPtr.Zero;
            try {
                if (root != AutomationElement.RootElement) {
                    baseHwnd = new IntPtr(root.Current.NativeWindowHandle);
                }
            } catch { }

            string targetClass = GetClassNameFromCondition(condition);
            if (!string.IsNullOrEmpty(targetClass)) {
                 IntPtr h = (baseHwnd == IntPtr.Zero) 
                    ? FindWindow(targetClass, null) 
                    : FindWindowEx(baseHwnd, IntPtr.Zero, targetClass, null);
                
                if (h != IntPtr.Zero) {
                    try {
                        AutomationElement el = AutomationElement.FromHandle(h);
                        if (el != null) {
                             if (el.FindFirst(TreeScope.Element, condition) != null) {
                                AddUnique(results, seenIds, el);
                             }
                        }
                    } catch { }
                }
            }
            
            List<IntPtr> candidates = (baseHwnd == IntPtr.Zero) 
                ? GetTopLevelWindows() 
                : GetChildWindows(baseHwnd);

             if (baseHwnd == IntPtr.Zero) {
                IntPtr trayHwnd = FindWindow("Shell_TrayWnd", null);
                if (trayHwnd != IntPtr.Zero && !candidates.Contains(trayHwnd)) {
                    candidates.Add(trayHwnd);
                }
            }

            foreach (IntPtr hwnd in candidates) {
                try {
                    AutomationElement el = AutomationElement.FromHandle(hwnd);
                    if (el != null) {
                        if (el.FindFirst(TreeScope.Element, condition) != null) {
                            AddUnique(results, seenIds, el);
                        }

                         if ((scope & (TreeScope.Descendants | TreeScope.Subtree)) != 0) {
                            AutomationElementCollection subMatches = el.FindAll(TreeScope.Subtree, condition);
                            foreach (AutomationElement sub in subMatches) {
                                AddUnique(results, seenIds, sub);
                            }
                        }
                    }
                } catch { }
            }
            
            // Additional Win32 Name-based fallback if still no results
            if (results.Count == 0 && (scope & (TreeScope.Descendants | TreeScope.Children | TreeScope.Subtree)) != 0) {
                string targetName = GetNameFromCondition(condition);
                if (!string.IsNullOrEmpty(targetName)) {
                    foreach (IntPtr hwnd in candidates) {
                        try {
                            StringBuilder sb = new StringBuilder(256);
                            GetWindowText(hwnd, sb, sb.Capacity);
                            string winText = sb.ToString();
                            
                            if (winText == targetName) {
                                AutomationElement matchEl = AutomationElement.FromHandle(hwnd);
                                if (matchEl != null) {
                                    AddUnique(results, seenIds, matchEl);
                                }
                            }
                        } catch { }
                    }
                }
            }
        }

        return results;
    }

    public static string GetPageSource(AutomationElement root) {
        if (root == null) return "<error>Root is null</error>";
        
        try {
            XmlDocument doc = new XmlDocument();
            ProcessElement(doc, null, root);
            return doc.OuterXml;
        } catch (Exception ex) {
            return "<error>" + System.Security.SecurityElement.Escape(ex.Message) + "</error>";
        }
    }

    private static void ProcessElement(XmlDocument doc, XmlElement parentXml, AutomationElement element) {
        if (element == null) return;

        XmlElement xmlNode = null;
        try {
            string tagName = "Group";
            try {
                // Simplified tag naming for compatibility
                string controlType = element.Current.ControlType.ProgrammaticName;
                tagName = controlType.Substring(controlType.LastIndexOf('.') + 1);
                if (tagName == "DataGrid") tagName = "List";
                if (tagName == "DataItem") tagName = "ListItem";
            } catch {
                 tagName = "Unknown";
            }
            
            xmlNode = doc.CreateElement(tagName);

            // Attributes
            AddAttribute(xmlNode, "Name", element.Current.Name);
            AddAttribute(xmlNode, "AutomationId", element.Current.AutomationId);
            AddAttribute(xmlNode, "ClassName", element.Current.ClassName);
            AddAttribute(xmlNode, "FrameworkId", element.Current.FrameworkId);
            AddAttribute(xmlNode, "LocalizedControlType", element.Current.LocalizedControlType);
            AddAttribute(xmlNode, "ProcessId", element.Current.ProcessId.ToString());
            
            try {
                int[] rid = element.GetRuntimeId();
                AddAttribute(xmlNode, "RuntimeId", string.Join(".", rid));
            } catch { }

            try {
                System.Windows.Rect rect = element.Current.BoundingRectangle;
                AddAttribute(xmlNode, "x", ((int)rect.X).ToString());
                AddAttribute(xmlNode, "y", ((int)rect.Y).ToString());
                AddAttribute(xmlNode, "width", ((int)rect.Width).ToString());
                AddAttribute(xmlNode, "height", ((int)rect.Height).ToString());
            } catch { }

            AddAttribute(xmlNode, "IsEnabled", element.Current.IsEnabled.ToString());
            AddAttribute(xmlNode, "IsOffscreen", element.Current.IsOffscreen.ToString());
            AddAttribute(xmlNode, "IsKeyboardFocusable", element.Current.IsKeyboardFocusable.ToString());
            AddAttribute(xmlNode, "HasKeyboardFocus", element.Current.HasKeyboardFocus.ToString());
            
            if (parentXml == null) doc.AppendChild(xmlNode);
            else parentXml.AppendChild(xmlNode);

        } catch {
            return; // Skip element if we can't access it
        }

        // Recursion
        try {
            AutomationElementCollection children = element.FindAll(TreeScope.Children, Condition.TrueCondition);
            foreach (AutomationElement child in children) {
                ProcessElement(doc, xmlNode, child);
            }
        } catch { }
    }

    private static void AddAttribute(XmlElement node, string name, string value) {
        if (!string.IsNullOrEmpty(value)) {
            node.SetAttribute(name, value);
        }
    }
}
'@

        # Set TEMP and TMP to DLL directory to avoid permission issues
        $originalTemp = $env:TEMP
        $originalTmp = $env:TMP
        $env:TEMP = $dllDir
        $env:TMP = $dllDir

        try {
            # Compile the C# code to DLL
            # Need to reference UIAutomationClient and UIAutomationTypes
            Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies "System.Windows.Forms", "UIAutomationClient", "UIAutomationTypes", "System.Xml", "WindowsBase" -OutputAssembly $dllPath -ErrorAction Stop
            Write-Output "UIAHelper.dll compiled successfully"

            # Load the newly compiled DLL
            Add-Type -Path $dllPath -ErrorAction Stop
            Write-Output "UIAHelper.dll loaded successfully"
        } catch {
            Write-Output "Compilation failed, falling back to in-memory loading"
            Write-Output $_.Exception.Message
            # Fallback: load in-memory if compilation fails
            Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies "System.Windows.Forms", "UIAutomationClient", "UIAutomationTypes", "System.Xml", "WindowsBase" -ErrorAction Stop
        } finally {
            # Restore original TEMP/TMP
            $env:TEMP = $originalTemp
            $env:TMP = $originalTmp
        }
    }
}

Write-Output "UIAHelper ready"
    `;
