# XPath Bug Summary — appium-novawindows2-driver

**Date:** 2026-03-20  
**File:** `lib/xpath/core.ts` → `executeStep()` (lines 570–608)

---

## Root Cause

The position filter (`positions` Set) is applied **after** the JS condition filter (`relativeExprNodes`), violating XPath semantics.

**Current (buggy):**
```
all elements → filter by contains()/starts-with() → validEls → slice by [N]
```
**Correct XPath order:**
```
all elements → slice by [N] → filter by contains()/starts-with() → validEls
```

---

## Bugs

| # | Severity | Example XPath | Got | Expected |
|---|----------|--------------|-----|----------|
| 1 | 🔴 HIGH | `//ListItem[./Text[6][contains(@Name,'[sign]')]]` | 0 | 1 |
| 2 | 🔴 HIGH | `//ListItem[./Text[last()][starts-with(@Name,'000')]]` | 0 | 1 |
| 3 | 🟡 MED  | `//Button[@Name='OK' or contains(@Name,'x')]` | unreliable | correct |
| 4 | 🟢 LOW  | `position() > 2` range comparisons | self-corrects after fix | — |

---

## Fix (one block in `executeStep`)

```typescript
// BEFORE applying conditions — slice by position FIRST
const positionsArray = Array.from(positions);
const hasBothPositionAndCondition = positionsArray.length > 0 && relativeExprNodes.length > 0;

// Disable psFilter optimization when position+condition are combined
const remainingExprNodes: ExprNode[] = [];
for (const exprNode of relativeExprNodes) {
    const psFilter = !hasBothPositionAndCondition
        ? convertExprNodeToPowerShellFilter(exprNode)
        : null;
    if (psFilter) find.setPsFilter(psFilter);
    else remainingExprNodes.push(exprNode);
}

const els = (await sendPowerShellCommand(find.buildCommand()))
    .split('\n').map(id => id.trim()).filter(Boolean)
    .map(id => new FoundAutomationElement(id));

// Step 1: position slice on full `els`
const candidateEls = positionsArray.length === 0
    ? els
    : positionsArray.map(idx => idx === 0x7FFFFFFF ? els[els.length - 1] : els[idx - 1]).filter(Boolean);

// Step 2: condition filter on positional subset
const validEls: FoundAutomationElement[] = [];
for (const [i, el] of candidateEls.entries()) {
    let ok = true;
    for (const expr of remainingExprNodes) {
        const [isTrue] = await handleFunctionCall(BOOLEAN, el, this, [i + 1, candidateEls.length], expr);
        if (!isTrue) { ok = false; break; }
    }
    if (ok) validEls.push(el);
}
return new AutomationElementGroup(...validEls);
```

---

## Test Evidence (from `app-source.xml`)

**ListItem "00001"** in SecureAge Profile dialog has 9 `Text` children:

| Index | Name |
|-------|------|
| [1] | `00001` |
| [2] | `qa` |
| [3] | `qa` |
| [4] | _(empty)_ |
| [5] | `Thu Mar 13 2031 11:51:03 AM GMT+08:00` |
| **[6]** | **`[sign],[SecureData encrypt]`** ← target |
| [7] | `4BB3C9165A8F0555E3C0896AA53` |
| [8] | `yes` |
| [9] | `00001` |

---

## Test File

`tests/debug/test_xpath_complex.py` — **37 test cases** across 10 groups:

| Group | Topic | Cases |
|-------|-------|-------|
| G1 | Index + Condition (Bug #1) | 6 |
| G2 | `last()` + Condition (Bug #2) | 2 |
| G3 | Baselines (should already pass) | 3 |
| G4 | `position()` comparisons | 4 |
| G5 | OR / AND combos | 5 |
| G6 | `starts-with` + index | 3 |
| G7 | Nested multi-step predicates | 6 |
| G8 | Deep descendant + complex | 5 |
| G9 | Union expressions | 2 |
| G10 | Attribute filters | 3 |

Run with: `conda activate py313 && python tests/debug/test_xpath_complex.py`
