# Raw data dump from inspect.exe for element

Name:	"00001"
ControlType:	UIA_ListItemControlTypeId (0xC357)
LocalizedControlType:	"list item"
BoundingRectangle:	{l:552 t:388 r:1143 b:405}
IsEnabled:	true
IsOffscreen:	false
IsKeyboardFocusable:	true
HasKeyboardFocus:	false
ProcessId:	6608
RuntimeId:	[2A.F01D8.4.0]
AutomationId:	"ListViewItem-0"
FrameworkId:	"Win32"
ProviderDescription:	"[pid:6608,providerId:0x0 Annotation:Microsoft: Annotation Proxy (unmanaged:uiautomationcore.dll); Main(parent link):Microsoft: ListView Item Proxy (unmanaged:uiautomationcore.dll)]"
LegacyIAccessible.ChildId:	0
LegacyIAccessible.DefaultAction:	"Double Click"
LegacyIAccessible.Description:	""
LegacyIAccessible.Help:	""
LegacyIAccessible.KeyboardShortcut:	""
LegacyIAccessible.Name:	"00001"
LegacyIAccessible.Role:	list item (0x22)
LegacyIAccessible.State:	focusable,selectable,multiple selectable (0x1300000)
LegacyIAccessible.Value:	""
SelectionItem.IsSelected:	false
SelectionItem.SelectionContainer:	"" list
IsAnnotationPatternAvailable:	false
IsDragPatternAvailable:	false
IsDockPatternAvailable:	false
IsDropTargetPatternAvailable:	false
IsExpandCollapsePatternAvailable:	false
IsGridItemPatternAvailable:	false
IsGridPatternAvailable:	false
IsInvokePatternAvailable:	true
IsItemContainerPatternAvailable:	false
IsLegacyIAccessiblePatternAvailable:	true
IsMultipleViewPatternAvailable:	false
IsObjectModelPatternAvailable:	false
IsRangeValuePatternAvailable:	false
IsScrollItemPatternAvailable:	true
IsScrollPatternAvailable:	false
IsSelectionItemPatternAvailable:	true
IsSelectionPatternAvailable:	false
IsSpreadsheetItemPatternAvailable:	false
IsSpreadsheetPatternAvailable:	false
IsStylesPatternAvailable:	false
IsSynchronizedInputPatternAvailable:	false
IsTableItemPatternAvailable:	false
IsTablePatternAvailable:	false
IsTextChildPatternAvailable:	false
IsTextEditPatternAvailable:	false
IsTextPatternAvailable:	false
IsTextPattern2Available:	false
IsTogglePatternAvailable:	false
IsTransformPatternAvailable:	false
IsTransform2PatternAvailable:	false
IsValuePatternAvailable:	false
IsVirtualizedItemPatternAvailable:	false
IsWindowPatternAvailable:	false
IsCustomNavigationPatternAvailable:	false
IsSelectionPattern2Available:	false
FirstChild:	"00001" text
LastChild:	"00001" text
Next:	"00002" list item
Previous:	"Vertical" scroll bar
Other Props:	Object has no additional properties
Children:	"00001" text
	"qa" text
	"qa" text
	"" text
	"Thu Mar 13 2031 11:51:03 AM GMT+08:00" text
	"[sign],SecureData encrypt" text
	"4BB3C9165A8F0555E3C0896AA53" text
	"yes" text
	"00001" text
Ancestors:	"" list
	"SecureAge Profile - qa" dialog
	"SecureAge 8.0.35 - qa" dialog
	"Desktop 1" pane
	[ No Parent ]

# Data get from getProperty all
deploy: ./scripts/mac/build_deploy_restart.sh
conda run -n py313 python tests/debug/test_att5.py

# debug-data1:
{"IsContentElement":"True","IsKeyboardFocusable":"True","ItemType":"","ProcessId":"6608","AutomationId":"","Orientation":"None","Name":"00001","LocalizedControlType":"item","IsControlElement":"True","ClassName":"","HasKeyboardFocus":"False","RuntimeId":"42,983512,4,0","BoundingRectangle":"552,388,591,17","SelectionItem.SelectionContainer":"42.983512","FrameworkId":"Win32","ControlType":"System.Windows.Automation.ControlType","IsEnabled":"True","AcceleratorKey":"","ItemStatus":"","IsPassword":"False","AccessKey":"","IsOffscreen":"False","HelpText":"","IsRequiredForForm":"False","SelectionItem.IsSelected":"False","IsDockPatternAvailable":"False","IsExpandCollapsePatternAvailable":"False","IsGridItemPatternAvailable":"False","IsGridPatternAvailable":"False","IsInvokePatternAvailable":"False","IsMultipleViewPatternAvailable":"False","IsRangeValuePatternAvailable":"False","IsSelectionItemPatternAvailable":"True","IsSelectionPatternAvailable":"False","IsScrollPatternAvailable":"False","IsSynchronizedInputPatternAvailable":"False","IsScrollItemPatternAvailable":"True","IsVirtualizedItemPatternAvailable":"False","IsItemContainerPatternAvailable":"False","IsTablePatternAvailable":"False","IsTableItemPatternAvailable":"False","IsTextPatternAvailable":"False","IsTogglePatternAvailable":"False","IsTransformPatternAvailable":"False","IsValuePatternAvailable":"False","IsWindowPatternAvailable":"False","LegacyIAccessible.DefaultAction":"Double Click","LegacyIAccessible.ChildId":"1","LegacyIAccessible.State":"19922944","LegacyIAccessible.Role":"34","LegacyIAccessible.Description":"Name: qa, Issuer: qa, Expiry Date: Thu Mar 13 2031 11:51:03 AM GMT+08:00, Usage: [sign],SecureData encrypt, Serial Number: 4BB3C9165A8F0555E3C0896AA53, Trust: yes, Private Key: 00001","LegacyIAccessible.Name":"00001"}

# debug-data2:
{"Name":"00001","AutomationId":"","BoundingRectangle":"552,388,591,17","HelpText":"","HasKeyboardFocus":"False","ClassName":"","IsKeyboardFocusable":"True","IsPassword":"False","Orientation":"None","IsContentElement":"True","IsControlElement":"True","ControlType":"DataItem","LocalizedControlType":"item","ItemStatus":"","SelectionItem.IsSelected":"False","AcceleratorKey":"","ItemType":"","ProcessId":"6608","IsOffscreen":"False","RuntimeId":"42,983512,4,0","SelectionItem.SelectionContainer":"42.983512","IsEnabled":"True","AccessKey":"","FrameworkId":"Win32","IsRequiredForForm":"False","IsDockPatternAvailable":"False","IsExpandCollapsePatternAvailable":"False","IsGridItemPatternAvailable":"False","IsGridPatternAvailable":"False","IsInvokePatternAvailable":"False","IsMultipleViewPatternAvailable":"False","IsRangeValuePatternAvailable":"False","IsSelectionItemPatternAvailable":"True","IsSelectionPatternAvailable":"False","IsScrollPatternAvailable":"False","IsSynchronizedInputPatternAvailable":"False","IsScrollItemPatternAvailable":"True","IsVirtualizedItemPatternAvailable":"False","IsItemContainerPatternAvailable":"False","IsTablePatternAvailable":"False","IsTableItemPatternAvailable":"False","IsTextPatternAvailable":"False","IsTogglePatternAvailable":"False","IsTransformPatternAvailable":"False","IsValuePatternAvailable":"False","IsWindowPatternAvailable":"False","LegacyIAccessible.State":"1048580","LegacyIAccessible.Name":"Administrator: Windows PowerShell","LegacyIAccessible.Role":"10","LegacyIAccessible.ChildId":"0"}

# debug-data3:
{"Name":"00001","AutomationId":"","BoundingRectangle":"552,388,591,17","HelpText":"","HasKeyboardFocus":"False","ClassName":"","IsKeyboardFocusable":"True","IsPassword":"False","Orientation":"None","IsContentElement":"True","IsControlElement":"True","ControlType":"DataItem","LocalizedControlType":"item","ItemStatus":"","SelectionItem.IsSelected":"False","AcceleratorKey":"","ItemType":"","ProcessId":"6608","IsOffscreen":"False","RuntimeId":"42,983512,4,0","SelectionItem.SelectionContainer":"42.983512","IsEnabled":"True","AccessKey":"","FrameworkId":"Win32","IsRequiredForForm":"False","IsDockPatternAvailable":"False","IsExpandCollapsePatternAvailable":"False","IsGridItemPatternAvailable":"False","IsGridPatternAvailable":"False","IsInvokePatternAvailable":"False","IsMultipleViewPatternAvailable":"False","IsRangeValuePatternAvailable":"False","IsSelectionItemPatternAvailable":"True","IsSelectionPatternAvailable":"False","IsScrollPatternAvailable":"False","IsSynchronizedInputPatternAvailable":"False","IsScrollItemPatternAvailable":"True","IsVirtualizedItemPatternAvailable":"False","IsItemContainerPatternAvailable":"False","IsTablePatternAvailable":"False","IsTableItemPatternAvailable":"False","IsTextPatternAvailable":"False","IsTogglePatternAvailable":"False","IsTransformPatternAvailable":"False","IsValuePatternAvailable":"False","IsWindowPatternAvailable":"False","LegacyIAccessible.DefaultAction":"Double Click","LegacyIAccessible.ChildId":"1","LegacyIAccessible.State":"19922944","LegacyIAccessible.Role":"34","LegacyIAccessible.Description":"Name: qa, Issuer: qa, Expiry Date: Thu Mar 13 2031 11:51:03 AM GMT+08:00, Usage: [sign],SecureData encrypt, Serial Number: 4BB3C9165A8F0555E3C0896AA53, Trust: yes, Private Key: 00001","LegacyIAccessible.Name":"00001"}

# debug-data4:
{"SelectionItem.SelectionContainer":"42.983512","AutomationId":"","ProcessId":"6608","AcceleratorKey":"","IsControlElement":"True","SelectionItem.IsSelected":"False","LocalizedControlType":"item","IsKeyboardFocusable":"True","IsRequiredForForm":"False","BoundingRectangle":"552,388,591,17","FrameworkId":"Win32","ControlType":"DataItem","HelpText":"","Orientation":"None","ItemStatus":"","RuntimeId":"42,983512,4,0","IsEnabled":"True","IsPassword":"False","Name":"00001","IsOffscreen":"False","HasKeyboardFocus":"False","ClassName":"","AccessKey":"","IsContentElement":"True","ItemType":"","IsDockPatternAvailable":"False","IsExpandCollapsePatternAvailable":"False","IsGridItemPatternAvailable":"False","IsGridPatternAvailable":"False","IsInvokePatternAvailable":"False","IsMultipleViewPatternAvailable":"False","IsRangeValuePatternAvailable":"False","IsSelectionItemPatternAvailable":"True","IsSelectionPatternAvailable":"False","IsScrollPatternAvailable":"False","IsSynchronizedInputPatternAvailable":"False","IsScrollItemPatternAvailable":"True","IsVirtualizedItemPatternAvailable":"False","IsItemContainerPatternAvailable":"False","IsTablePatternAvailable":"False","IsTableItemPatternAvailable":"False","IsTextPatternAvailable":"False","IsTogglePatternAvailable":"False","IsTransformPatternAvailable":"False","IsValuePatternAvailable":"False","IsWindowPatternAvailable":"False"}
