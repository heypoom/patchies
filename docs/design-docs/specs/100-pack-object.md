# 100. Pack Object

## Motivation

Patchies already has `unpack` for splitting arrays across outlets. A complementary `pack`
object lets patches collect values from multiple inlets and emit one compound list, matching
the common Pure Data pattern.

## Behavior

`pack` is a V2 text object.

- `pack` with no arguments creates two float inlets initialized to `0 0`.
- `float`/`f` creates a float inlet initialized to `0`.
- `symbol`/`s` creates a symbol inlet initialized to an empty string.
- `any`/`a` creates an any-message inlet initialized to `null`.
- A numeric creation argument creates a float inlet initialized to that number.
- The first inlet is hot: accepted values update its stored value and immediately output the
  packed list.
- A bang into the first inlet outputs the current packed list without changing stored values.
- Later inlets are cold: accepted values update stored values without output.
- The single outlet emits the packed list as an array.

Pointer support is out of scope for this first pass because Patchies does not currently have a
pointer message type equivalent to Pure Data data-structure pointers.

## UI And Metadata

`pack` uses dynamic inlets derived from creation arguments, so the object UI and V2 object
service need to read instance-level inlet metadata when available. Static metadata describes
the default two-float shape for generated docs and object discovery.

## Documentation

Object docs should present `pack` as the counterpart to `unpack`, explain the hot/cold inlet
pattern, list supported type specifiers, and link to `unpack` and `trigger`.
