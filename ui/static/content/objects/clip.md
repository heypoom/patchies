Clamp a number to a min/max range.

## Usage

```
clip 0 1
clip -1 1
```

The first argument sets the minimum, the second sets the maximum.

## Inlets

- **Inlet 0** (hot): Value to clip — outputs the clamped result immediately
- **Inlet 1**: Minimum value (lower bound)
- **Inlet 2**: Maximum value (upper bound)

## See Also

- [expr](/docs/objects/expr) - mathematical expressions
- [float](/docs/objects/float) - store a float value
