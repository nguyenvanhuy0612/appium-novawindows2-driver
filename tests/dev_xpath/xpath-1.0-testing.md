# XPath 1.0 – Concepts & Stress Test Examples

## 📌 Overview

This document provides:

- Core XPath 1.0 concepts
- Edge cases that commonly break custom implementations
- Stress-test XPath expressions
- Sample XML dataset for testing

---

# 🧠 1. Core Concepts

## 1.1 Node Types

XPath operates on node types:

- Element
- Attribute
- Text
- Comment
- Processing Instruction
- Root

---

## 1.2 Axes

child::, parent::, self::, ancestor::, descendant::, following::, preceding::, following-sibling::, preceding-sibling::, attribute::, namespace::

---

## 1.3 Node Tests

node(), text(), comment(), processing-instruction(), *

---

## 1.4 Predicates

Example:
```xpath
//book[price > 10]
```

---

## 1.5 Functions

position(), last(), count(), string(), contains(), starts-with(), substring(), normalize-space(), boolean(), not(), number()

---

## 1.6 Operators

Logical: and, or  
Comparison: = != > < >= <=  
Arithmetic: + - * div mod  
Union: |

---

# ⚠️ 2. Critical Edge Cases

## Node-set Comparison
```xpath
//a/@id = //b/@ref
```

## NaN Behavior
```xpath
0 div 0 != 0 div 0
1 div 0 = 1 div 0
```

## Predicate Context
```xpath
//item[position() = 1]
```

---

# 🧪 3. Stress Test Expressions

## Mega Expression
```xpath
/descendant-or-self::node()
[
  (self::* or self::text() or self::comment())
  and not(self::processing-instruction())
  and (ancestor::* or descendant::* or following::* or preceding::*)
  and (@* and count(@*) >= 0)
  and (string-length(normalize-space(string(.))) >= 0)
  and (number(position()) = position())
]
```

## Axis Test
```xpath
//node()[ancestor::*[1]/following-sibling::* or following::node()[1]]
```

## Predicate Test
```xpath
//*[position()=1 or position()=last() or position() mod 2=1]
```

## Node-set Comparison
```xpath
//*[@id = //*/@ref]
```

## Function Chain
```xpath
//*[contains(normalize-space(string(.)), substring-before(concat(name(),'x'),'x'))]
```

## Union
```xpath
(//* | //node() | //@* | //text())
```

## Boolean
```xpath
//*[. and string(.) and number(.) = number(.)]
```

## NaN
```xpath
//*[(0 div 0) != (0 div 0)]
```

---

# 🧩 4. Sample XML

```xml
<root>
  <book id="1" category="fiction">
    <author>John Doe</author>
    <price>15</price>
    <title>Book A</title>
  </book>

  <book id="2" category="tech">
    <author>Jane</author>
    <price>5</price>
    <title>Book B</title>
  </book>

  <a id="1">
    <b ref="1">text</b>
  </a>

  <a id="2">
    <b ref="2"/>
  </a>

  <c>
    <!-- comment -->
  </c>
</root>
```

---

# 🧪 5. Test Case Example

```json
{
  "xpath": "//book[price > 10]",
  "expected_count": 1,
  "expected_nodes": ["Book A"]
}
```

---

# ✅ Summary

Use multiple XPath expressions to fully validate your engine, covering all syntax, edge cases, and behaviors.
