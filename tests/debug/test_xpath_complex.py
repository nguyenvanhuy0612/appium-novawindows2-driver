"""
Complex XPath Test Suite — derived from app-source.xml
Covers: index+condition, position() ranges, OR/AND combos,
        nested predicates, last(), starts-with, deep traversal,
        multi-axis, union, and attribute wildcard patterns.

All expected values are derived statically from app-source.xml.
Run against: http://172.16.10.37:4723,  automationName=NovaWindows2, app=Root
"""

import time
from appium import webdriver
from appium.options.windows import WindowsOptions
from appium.webdriver.common.appiumby import AppiumBy

# ─────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────
options = WindowsOptions()
options.load_capabilities({
    "platformName": "Windows",
    "appium:automationName": "NovaWindows2",
    "appium:app": "Root",
    "appium:newCommandTimeout": 300
})

driver = webdriver.Remote('http://172.16.10.37:4723', options=options)
print("Connected successfully!\n")

results = []

def check(label, xpath, expected_count, notes=""):
    t = time.time()
    els = driver.find_elements(AppiumBy.XPATH, xpath)
    elapsed = round(time.time() - t, 2)
    status = "PASS" if len(els) == expected_count else f"FAIL (got {len(els)}, expected {expected_count})"
    results.append((label, status, elapsed, notes))
    print(f"[{status}] {label} — {elapsed}s")
    if "FAIL" in status and notes:
        print(f"        ↳ {notes}")

# ══════════════════════════════════════════════
# GROUP 1: Index + Condition  (Bug #1 core case)
# Source: ListItem Name="00001" has 9 Text children:
#   [1]=00001  [2]=qa  [3]=qa  [4]=""  [5]=Thu Mar 13 2031...
#   [6]=[sign],[SecureData encrypt]  [7]=4BB3C...  [8]=yes  [9]=00001
# ══════════════════════════════════════════════
print("=== GROUP 1: Index + Condition ===")

check(
    "G1-A  index[6]+contains",
    "//ListItem[./Text[6][contains(@Name,'[sign]')]]",
    1,  # ListItem "00001" whose 6th Text contains '[sign]'
    "BUG #1: position applied after condition — was returning 0"
)

check(
    "G1-B  index[1]+exact-match",
    "//ListItem[./Text[1][@Name='00001']]",
    1,  # ListItem whose 1st Text is '00001'
    "BUG #1: same pattern, equality variant"
)

check(
    "G1-C  index[2]+exact-match-qa",
    "//ListItem[./Text[2][@Name='qa']]",
    1,  # ListItem whose 2nd Text is 'qa'
    "BUG #1: 2nd child exact match"
)

check(
    "G1-D  index[8]+exact-match-yes",
    "//ListItem[./Text[8][@Name='yes']]",
    1,  # 8th Text child = 'yes'
    "BUG #1: deep index"
)

check(
    "G1-E  index[9]+starts-with",
    "//ListItem[./Text[9][starts-with(@Name,'000')]]",
    1,  # 9th Text = '00001', starts-with '000'
    "BUG #1 + starts-with variant"
)

check(
    "G1-F  wrong-index[7]+contains-sign (should be 0)",
    "//ListItem[./Text[7][contains(@Name,'[sign]')]]",
    0,  # 7th Text = serial number, not sign → 0
    "BUG #1 regression: wrong index should yield 0"
)

# ══════════════════════════════════════════════
# GROUP 2: last() + Condition  (Bug #4)
# ══════════════════════════════════════════════
print("\n=== GROUP 2: last() + Condition ===")

check(
    "G2-A  [last()]+contains on Text children",
    "//ListItem[./Text[last()][starts-with(@Name,'000')]]",
    1,  # last (9th) Text = '00001', starts with '000'
    "BUG #4: last() position applied after condition — was 0"
)

check(
    "G2-B  [last()] TabItem in inner Tab",
    "//Window[@Name='SecureAge Profile - qa']//Tab[1]/TabItem[last()]",
    1,  # 7th TabItem = 'Configurations'
    "last() on sibling axis"
)

# ══════════════════════════════════════════════
# GROUP 3: condition only (no index) — baseline
# ══════════════════════════════════════════════
print("\n=== GROUP 3: Condition Only (baseline) ===")

check(
    "G3-A  contains without index",
    "//ListItem[./Text[contains(@Name,'[sign]')]]",
    1,
    "Baseline: condition alone — should already work"
)

check(
    "G3-B  index only without condition",
    "//ListItem[./Text[6]]",
    1,
    "Baseline: index alone — should already work"
)

check(
    "G3-C  attribute equality on ListItem",
    "//ListItem[@Name='00001']",
    1,
    "Baseline: direct attribute equality"
)

# ══════════════════════════════════════════════
# GROUP 4: position() comparisons  (Bug #2)
# Desktop List has 17 ListItems (index 1..17)
# ══════════════════════════════════════════════
print("\n=== GROUP 4: position() Comparisons ===")

check(
    "G4-A  //List[@Name='Desktop']/ListItem[position()=1]",
    "//List[@Name='Desktop']/ListItem[position()=1]",
    1,  # 'Recycle Bin'
    "position()=N equality"
)

check(
    "G4-B  //List[@Name='Desktop']/ListItem[3]",
    "//List[@Name='Desktop']/ListItem[3]",
    1,  # 'software1'
    "Numeric shorthand [3]"
)

check(
    "G4-C  //List[@Name='Desktop']/ListItem[last()]",
    "//List[@Name='Desktop']/ListItem[last()]",
    1,  # last desktop item
    "last() on Desktop list"
)

check(
    "G4-D  TreeItem[position()=2] in Quick access",
    "//TreeItem[@Name='Quick access']/TreeItem[2]",
    1,  # 'Downloads'
    "position() on TreeItem children"
)

# ══════════════════════════════════════════════
# GROUP 5: OR / AND Combinations  (Bug #3)
# ══════════════════════════════════════════════
print("\n=== GROUP 5: OR / AND in Predicates ===")

check(
    "G5-A  Button[@Name='OK' or @Name='Cancel']",
    "//Button[@Name='OK' or @Name='Cancel']",
    2,  # OK + Cancel in SecureAge dialog
    "BUG #3: OR across two attribute conditions"
)

check(
    "G5-B  Button[@Name='OK' or @Name='Apply' or @Name='Help']",
    "//Button[@Name='OK' or @Name='Apply' or @Name='Help']",
    3,
    "BUG #3: chained OR"
)

check(
    "G5-C  Button[contains(@Name,'Import') or contains(@Name,'Export')]",
    "//Button[contains(@Name,'Import') or contains(@Name,'Export')]",
    3,  # Import P11, Import P12, Export P12
    "BUG #3: OR with two contains()"
)

check(
    "G5-D  Button[@IsEnabled='False' and contains(@Name,'P1')]",
    "//Button[@IsEnabled='False' and contains(@Name,'P1')]",
    0,  # Import P11/P12 are enabled=True
    "AND combining attribute + contains"
)

check(
    "G5-E  TabItem in inner Tab that is enabled",
    "//Window[@Name='SecureAge Profile - qa']//Tab[@AutomationId='1482']/TabItem[@IsEnabled='True']",
    7,  # All 7 tabs in inner Tab are enabled
    "AND: two attribute conditions via chaining"
)

# ══════════════════════════════════════════════
# GROUP 6: starts-with  (PS filter path)
# ══════════════════════════════════════════════
print("\n=== GROUP 6: starts-with ===")

check(
    "G6-A  Button[starts-with(@Name,'Import')]",
    "//Button[starts-with(@Name,'Import')]",
    2,  # Import P11, Import P12
    "starts-with basic"
)

check(
    "G6-B  ListItem[starts-with(@Name,'Automation')]",
    "//ListItem[starts-with(@Name,'Automation')]",
    3,  # Automation Profile53244366, Automation Profile88039862, Automation Test Edited88637543
    "starts-with in ComboBox list"
)

check(
    "G6-C  index+starts-with combo",
    "//ComboBox//ListItem[2][starts-with(@Name,'Automation')]",
    1,  # 2nd ListItem in ComboBox = Automation Profile53244366
    "BUG #1 variant: index + starts-with"
)

# ══════════════════════════════════════════════
# GROUP 7: Nested Multi-Step Predicates
# ══════════════════════════════════════════════
print("\n=== GROUP 7: Nested Multi-Step Predicates ===")

check(
    "G7-A  Window > Tab > TabItem[3] (Peer Certificates)",
    "//Window[@Name='SecureAge Profile - qa']//Tab[@AutomationId='1482']/TabItem[3]",
    1,
    "Nested step with index"
)

check(
    "G7-B  List > Header > HeaderItem[5] (Expiry Date)",
    "//List[@AutomationId='1485']//HeaderItem[5]",
    1,  # HeaderItem 'Expiry Date'
    "Index on deeply nested HeaderItem"
)

check(
    "G7-C  List > Header > HeaderItem[@Name='Serial Number']",
    "//List[@AutomationId='1485']//HeaderItem[@Name='Serial Number']",
    1,
    "Attribute match on nested HeaderItem"
)

check(
    "G7-D  ToolBar[@Name='Clipboard']/Button[2] (Copy button)",
    "//ToolBar[@Name='Clipboard']/Button[2]",
    1,  # Button 'Copy'
    "Index on Toolbar buttons"
)

check(
    "G7-E  ToolBar[@Name='Clipboard']/Button[2][contains(@Name,'Copy')]",
    "//ToolBar[@Name='Clipboard']/Button[2][contains(@Name,'Copy')]",
    1,  # Button 'Copy' — index+condition combo
    "BUG #1: index+contains on ToolBar child"
)

check(
    "G7-F  ToolBar[@Name='Clipboard']/Button[2][@Name='Paste'] (should be 0)",
    "//ToolBar[@Name='Clipboard']/Button[2][@Name='Paste']",
    0,  # Button[2] is 'Copy', not 'Paste'
    "BUG #1 regression: index matches but condition fails → 0"
)

# ══════════════════════════════════════════════
# GROUP 8: Deep Descendant + Complex Predicates
# ══════════════════════════════════════════════
print("\n=== GROUP 8: Deep Descendant + Complex ===")

check(
    "G8-A  //Window//Button[@AutomationId='Close'][not(@IsEnabled='False')]",
    "//Window//Button[@AutomationId='Close'][not(@IsEnabled='False')]",
    2,  # PlainFolder Close (enabled=True) + SecureAge Profile Close (enabled=True)
    "not() predicate on enabled Close buttons"
)

check(
    "G8-B  //ToolBar//Button[contains(@Name,'Appium')]",
    "//ToolBar//Button[contains(@Name,'Appium')]",
    2,  # 'Appium SO - 1 running window' + taskbar Appium button
    "Descendant contains on ToolBar"
)

check(
    "G8-C  //TreeItem[@Name='Quick access']/TreeItem[contains(@Name,'Folder')]",
    "//TreeItem[@Name='Quick access']/TreeItem[contains(@Name,'Folder')]",
    2,  # 'CertificateFolder' + 'PlainFolder'
    "Index skipped, condition on Tree children"
)

check(
    "G8-D  //TreeItem[@Name='Quick access']/TreeItem[5][contains(@Name,'appium')]",
    "//TreeItem[@Name='Quick access']/TreeItem[5][contains(@Name,'appium')]",
    1,  # 5th child = 'appium'
    "BUG #1: index[5]+contains on TreeItem"
)

check(
    "G8-E  //TreeItem[@Name='Quick access']/TreeItem[5][@Name='appium']",
    "//TreeItem[@Name='Quick access']/TreeItem[5][@Name='appium']",
    1,  # Same but with equality
    "BUG #1: index[5]+equality on TreeItem"
)

# ══════════════════════════════════════════════
# GROUP 9: Union Expressions
# ══════════════════════════════════════════════
print("\n=== GROUP 9: Union ===")

check(
    "G9-A  Button[@Name='OK'] | Button[@Name='Cancel']",
    "//Button[@Name='OK'] | //Button[@Name='Cancel']",
    2,
    "Union of two button selectors"
)

check(
    "G9-B  TabItem[@Name='CRL'] | TabItem[@Name='OCSP']",
    "//TabItem[@Name='CRL'] | //TabItem[@Name='OCSP']",
    3,  # Both exist in inner Tab AND menu bar has CRL/OCSP too
    "Union of tab items across multiple containers"
)

# ══════════════════════════════════════════════
# GROUP 10: Attribute Existence + Complex Filters
# ══════════════════════════════════════════════
print("\n=== GROUP 10: Attribute Filters ===")

check(
    "G10-A  Button[@HelpText and contains(@HelpText,'P1')]",
    "//Button[contains(@HelpText,'P1')]",
    2,  # HelpText='Import P11', HelpText='Import P12'
    "contains on HelpText attribute"
)

check(
    "G10-B  Button[@AutomationId='DropDown']",
    "//Button[@AutomationId='DropDown']",
    1,  # ComboBox dropdown button
    "AutomationId exact match"
)

check(
    "G10-C  HeaderItem[@Name='Expiry Date' or @Name='Serial Number']",
    "//HeaderItem[@Name='Expiry Date' or @Name='Serial Number']",
    2,
    "OR on named header items"
)

# ── Summary ──────────────────────────────────
driver.quit()
print("\n" + "="*60)
print(f"{'Label':<50} {'Result':<25} {'Time':>6}")
print("="*60)
pass_count = fail_count = 0
for label, status, elapsed, _ in results:
    print(f"{label:<50} {status:<25} {elapsed:>5}s")
    if "PASS" in status:
        pass_count += 1
    else:
        fail_count += 1
print("="*60)
print(f"PASSED: {pass_count}  |  FAILED: {fail_count}  |  TOTAL: {len(results)}")
