Float accumulator. Stores and outputs a floating-point value.

Alias: `float`

## Inlets

- **Inlet 0 (hot)**: Set value and output immediately. Bang outputs current value.
- **Inlet 1 (cold)**: Set value without outputting.

## Arguments

- `f <initial>` - Set initial value (e.g., `f 3.14` starts with value 3.14)

## See Also

- [i](/docs/objects/i) - integer accumulator
- [expr](/docs/objects/expr) - expression evaluator
- [Hot and Cold Inlets](/docs/topics/hot-cold-inlets)
