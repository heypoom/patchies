# 160. Numeric Operator Objects

## Motivation

Patchies has `expr` for arbitrary math and `scale` / `clip` for common numeric transforms.
Small arithmetic changes are common enough that `+`, `-`, `*`, and `/` should be available as
compact text objects without requiring a full expression.

## Behavior

`+`, `-`, `*`, and `/` are V2 text objects for numeric control messages.

- `+ n` adds `n` to incoming numbers.
- `- n` subtracts `n` from incoming numbers.
- `* n` multiplies incoming numbers by `n`.
- `/ n` divides incoming numbers by `n`.
- With no argument, the right operand defaults to `0`, matching the audio operator default.
- Inlet 0 is hot: a number is transformed and emitted immediately.
- Inlet 1 is cold: a number updates the right operand without output.
- `/ 0` emits `0` instead of `Infinity` or `NaN`.

## UI And Metadata

The operators belong in the Transforms pack near `expr`, `scale`, and `clip`. They use the
literal object names `+`, `-`, `*`, and `/`, but their documentation routes use URL-safe slugs:
`add`, `sub`, `mul`, and `div`.

## Documentation

Object docs should show one-line creation examples, describe the hot/cold inlet behavior, and
link to `expr` for formulas that require multiple variables or more than one operation.
