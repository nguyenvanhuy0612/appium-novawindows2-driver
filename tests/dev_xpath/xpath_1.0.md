You are a senior QA Automation Engineer and XPath 1.0 specification expert.

Your task is to rigorously validate the correctness of a feature that parses and evaluates XPath 1.0 expressions (a custom XPath engine or implementation).

This is a critical system component. You must assume it may contain hidden logical bugs.

CONTEXT:

The system accepts ANY XPath 1.0 expression as input and evaluates it against XML/HTML.

Your goal is to ensure:

Full compliance with XPath 1.0 behavior
No logical inconsistencies
Correct handling of all edge cases

REQUIREMENTS:

Core XPath 1.0 Coverage (VERY IMPORTANT)

List ALL core features that must be validated:

Axes:
child, parent, descendant, ancestor, following-sibling, preceding-sibling, etc.
Node tests:
element, attribute, text(), node()
Predicates:
filtering, chaining, nested predicates
Functions:
position(), last(), contains(), starts-with(), not(), etc.
Operators:
=, !=, <, >, and, or
Data types:
node-set, boolean, string, number (and conversions between them)
Identify High-Risk Logic Areas

Explain where XPath engines usually fail:

Context node mis-handling
Predicate evaluation order
position() vs index confusion
[1] vs (xpath)[1]
Boolean conversion of node-set
Empty node-set behavior
Axis traversal mistakes
Incorrect short-circuit logic (and/or)
Generate Comprehensive Test Suite (MANDATORY)

Generate at least 20–30 XPath test cases with XML samples.

Cover ALL categories:

A. Basic

simple selection
single node match
no match

B. Axis-heavy

descendant vs child
ancestor traversal
sibling ordering

C. Predicate complexity

multiple predicates
nested predicates
mixed conditions

D. Indexing edge cases

[1], [last()], [position()]
(xpath)[1] vs xpath[1]

E. Functions

contains()
starts-with()
not()
last()

F. Boolean logic

and / or combinations
node-set in boolean context

G. Edge cases

empty nodes
missing attributes
duplicate nodes
deep nesting (≥5 levels)
mixed content (text + element)
Expected Results (CRITICAL)

For EACH test case:

Provide XML
Provide XPath
Provide expected result (exact nodes)
Explain WHY (based on XPath 1.0 rules)
Spec Compliance Check

For each behavior, verify alignment with XPath 1.0 rules:

Predicate filters node-set sequentially
XPath uses 1-based indexing
Node-set to boolean conversion rules
String vs number comparison behavior
Mutation Testing (VERY IMPORTANT)

Take correct XPath cases and mutate them:

change axis
move predicates
change index
wrap with parentheses

Explain how results MUST change.

If your system would not detect differences → highlight as a bug risk.

Failure Scenario Detection

List possible incorrect implementations:

always returning first match
ignoring predicate order
flattening node-set incorrectly
treating node-set as array improperly
incorrect context propagation
Suggest Test Strategy

Provide:

how to automate testing (Java / Python)
how to validate results programmatically
how to compare expected vs actual
Risk Assessment

Classify:

HIGH → likely incorrect XPath evaluation
MEDIUM → edge case failures
LOW → mostly compliant

RULES:

XPath 1.0 ONLY (no XPath 2.0)
Be extremely strict
Think like a spec validator, not a developer
Cover ALL edge cases
Assume implementation may be incorrect