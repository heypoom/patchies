Collects values from multiple inlets and outputs them as one array.

## Usage

```text
pack <type1> <type2> ...
```

With no arguments, `pack` creates two float inlets initialized to `0 0`.

## Arguments

- `float` or `f` — float inlet initialized to `0`
- `symbol` or `s` — symbol inlet initialized to an empty string
- `any` or `a` — any-message inlet initialized to `null`
- a number — float inlet initialized to that number

Pointer arguments from Pure Data are not supported.

## Inlets

The first inlet is hot. Sending a value to it updates that stored value and outputs
the packed array. Sending a bang to the first inlet outputs the current packed array
without changing any stored values.

All later inlets are cold. They update their stored values without outputting.

## Examples

`pack f s` receives `kick` on inlet 1, then `12` on inlet 0:

1. Inlet 1 stores `"kick"` and outputs nothing
2. Inlet 0 stores `12`
3. Outlet sends `[12, "kick"]`

`pack 440 s f` starts with `[440, "", 0]`. A bang on inlet 0 outputs that current
array.

`pack f a` can combine a number with any stored message, such as `[7, { nested: true }]`.

_Inspired by [Pure Data](https://pd.iem.sh/objects/pack)._

## See Also

- [unpack](/docs/objects/unpack) - split an array into separate outlets
- [trigger](/docs/objects/trigger) - fan out a single message in a defined order
- [float](/docs/objects/float) - store and output one float value
