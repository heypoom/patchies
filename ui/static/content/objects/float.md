Float accumulator. Stores and outputs a floating-point value.

Alias: `f`

## Inlets

- **Inlet 0 (hot)**: Set value and output immediately. Bang outputs current value.
- **Inlet 1 (cold)**: Set value without outputting.

## Arguments

- `float <initial>` - Set initial value (e.g., `float 3.14` starts with value 3.14)

_Inspired by [Pure Data](https://pd.iem.sh/objects/float)._

## See Also

- [int](/docs/objects/int) - integer accumulator
- [expr](/docs/objects/expr) - expression evaluator
- [Hot and Cold Inlets](/docs/topics/hot-cold-inlets)
