# 144. Scale Object

## Motivation

Patchies has `map` for JavaScript message transforms and `clip` for clamping a number to a
range. A dedicated `scale` text object gives patches a compact way to remap numeric controls
from one range to another without writing an expression.

## Behavior

`scale` is a V2 text object.

- `scale inMin inMax outMin outMax` sets the source and target ranges.
- With no arguments, `scale` defaults to `0 1 0 1`.
- Inlet 0 is hot: a number is remapped and emitted immediately.
- Inlets 1-4 are cold numeric params: `inMin`, `inMax`, `outMin`, and `outMax`.
- Values outside the source range are extrapolated by default.
- If the source range has zero length, the object does not emit a value.

## UI And Metadata

`scale` belongs in the Transforms pack near `clip`, uses five float/message inlets, and emits
one float outlet. The object name intentionally follows Max/Pure Data vocabulary and avoids
conflicting with Patchies' existing JavaScript `map` object.

## Documentation

Object docs should show common mappings such as MIDI velocity `0..127` to normalized `0..1`,
explain extrapolation, and link to `clip` for constraining values.
