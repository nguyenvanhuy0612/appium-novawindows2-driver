# Issue: LocalizedControlType is not correct

## Description

When using Inspect.exe to inspect a list control, the control type is reported as `List` / `ListItem`. However, the PowerShell UIA implementation returns `DataGrid` / `DataItem` for the same elements. This causes XPath selectors like `//List` or `//ListItem` to fail to find elements that exist.

## Steps to Reproduce

Use the following XPath locators against the SecureAge Profile window:

```
//Window[@Name='SecureAge Profile - qa']//DataGrid   → finds the element (wrong type)
//Window[@Name='SecureAge Profile - qa']//List       → should find it (correct type per Inspect.exe)
```

## Root Cause

The UIA `ControlType` property returned by the automation layer (`DataGrid` / `DataItem`) does not match what Inspect.exe shows (`List` / `ListItem`). Both `ControlType.ProgrammaticName` and `LocalizedControlType` return `DataGrid` / `data grid` — there is no property available at the driver level that returns the correct `List` value. The mismatch is entirely inside the application's UIA provider and cannot be distinguished or corrected externally.

No reliable fix exists at the driver level because `ControlType` is set by the application's UIA provider and cannot be overridden externally.

### Why a `LocalizedControlType` cross-check does not work

A cross-check approach was investigated:
```powershell
# Attempted — does NOT work
if ($tagName -eq 'DataGrid' -and $localizedControlType -eq 'List') { $tagName = 'List' }
```
This fails because `LocalizedControlType` also returns `"data grid"` for these elements (not `"List"`). There is no available property that reliably distinguishes a misreporting DataGrid from a genuine one at the driver level, so the alias must be applied unconditionally.

## Workaround (Currently Implemented)

An unconditional alias is applied at every layer where control types are used:

- `DataGrid` is treated as `List`
- `DataItem` is treated as `ListItem`

### Summary of 5 Locations

| # | File | Lines | Entry Point | Purpose |
|---|------|-------|-------------|---------|
| 1 | `lib/driver.ts` | 140–152 | `findElement('tag name', 'list')` | Appium tag name strategy — builds OR condition so UIA tree search matches both List and DataGrid |
| 2 | `lib/commands/functions.ts` | 163–164 | Page source XML generation | Renames DataGrid→List in the XML output so `//List` XPath against page source finds the element |
| 3 | `lib/powershell/elements.ts` | 504–515 | `driver.getTagName(element)` | Returns "List" instead of "DataGrid" when client calls getTagName on the element |
| 4 | `lib/xpath/core.ts` | 689–701 | XPath node test `//List` | Builds OR condition for XPath live UIA tree traversal so `//List` matches DataGrid elements |
| 5 | `lib/powershell/converter.ts` | 322–336 | XPath attribute `[@ControlType='List']` | Builds OR condition when ControlType is used as an XPath attribute predicate |

### Affected Code Locations (5 places)

**`lib/driver.ts` lines 140–152** — `tag name` strategy (e.g. `driver.findElement('tag name', 'List')`):
```typescript
if (tag === 'list') {
    condition = new OrCondition(
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('List')),
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataGrid'))
    );
} else if (tag === 'listitem') {
    condition = new OrCondition(
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('ListItem')),
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataItem'))
    );
}
```

**`lib/commands/functions.ts` lines 163–164** — PowerShell script that builds the element's tag name for page source XML:
```powershell
if ($tagName -eq 'DataGrid') { $tagName = 'List' }
elseif ($tagName -eq 'DataItem') { $tagName = 'ListItem' }
```
Ensures elements with `ControlType=DataGrid` appear as `<List>` in the page source so `//List` XPath queries match them.

**`lib/powershell/elements.ts` lines 504–515** — `GET_ELEMENT_TAG_NAME` PS script (Appium `getTagName()` command):
```powershell
$type = $_.Split('.')[-1];
if ($type -eq 'DataGrid') {
    return 'List';
} elseif ($type -eq 'DataItem') {
    return 'ListItem';
}
return $type;
```
Ensures `driver.getTagName(element)` returns `"List"` instead of `"DataGrid"`.

**`lib/xpath/core.ts` lines 689–701** — XPath node test condition building (`//List` in XPath):
```typescript
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
```

**`lib/powershell/converter.ts` lines 322–336** — XPath attribute condition `[@ControlType='List']`:
```typescript
if (val.endsWith('::list')) {
    processedItems.push(new OrCondition(
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('List')),
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataGrid'))
    ));
} else if (val.endsWith('::listitem')) {
    processedItems.push(new OrCondition(
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('ListItem')),
        new PropertyCondition(Property.CONTROL_TYPE, new PSControlType('DataItem'))
    ));
}
```

## Known Limitations

- The alias is unconditional — all `DataGrid` elements are renamed to `List` globally, including any app that legitimately uses `DataGrid`. There is no way to distinguish them.
- `//DataGrid` in XPath still finds DataGrid elements (live UIA query), but the page source shows them as `<List>`. This inconsistency is minor and unavoidable.
- This is a permanent workaround. A proper fix would require the application vendor to correct the UIA provider.

## Status

Workaround active across all 5 locations. No upstream fix available. No further code action needed.
