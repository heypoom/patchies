# 166. Boolean and Conditional Operator Objects

## Motivation

Patchies already has `expr` and `filter` for arbitrary conditions, plus `spigot` for
message gating. Building small logic circuits should not require a full expression, so
boolean and comparison operators should exist as compact text objects like the existing
numeric `+`, `-`, `*`, and `/` objects.

## Behavior

Add V2 text objects for:

- `&&` / `and`: output whether both operands are true.
- `||` / `or`: output whether either operand is true.
- `!` / `not`: output the inverse of the incoming operand.
- `==`: output strict equality between the incoming value and the stored operand.
- `!=`: output strict inequality between the incoming value and the stored operand.
- `<`, `<=`, `>`, `>=`: output numeric comparisons against the stored operand.

`&&`, `||`, `==`, `!=`, `<`, `<=`, `>`, and `>=` use inlet 0 as the hot left operand and
inlet 1 as the cold right operand. Sending a non-bang message to the hot inlet stores the
left operand, evaluates, and outputs a boolean. Sending `bang` to the hot inlet re-emits
the operation using the previously stored operands. Sending a message to the cold inlet
stores the right operand without output.

`!` has one hot inlet. Sending a non-bang message stores the input and outputs the boolean
inverse immediately. Sending `bang` re-emits using the previously stored input.

## Truthiness

Boolean operators accept booleans, numbers, strings, and other message values. Truthiness
matches the existing `spigot` control behavior for numbers:

- `true` is true and `false` is false.
- Numbers behave like `Boolean(number)` in JavaScript: `0` and `NaN` are false,
  and other numbers are true.
- Non-empty strings are true.
- Other values are false unless later object families establish a broader truthiness
  contract.

## UI And Metadata

The operators belong in the Transforms pack near `expr`, `filter`, `select`, and the
numeric operators. They should use literal object names in patches, with word aliases for
search and typing convenience.

## Documentation

Object docs should show tiny wiring examples with `toggle`, numeric comparisons, and
`spigot`. For multi-step formulas, docs should point users to `expr` and `filter`.
