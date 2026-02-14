Clamp a signal to a range. Values below min are set to min, values above max are set to max.

## Usage

```
osc~ 440 → clip~ -0.5 0.5
```

Default range is [-1, 1]. Set min and max via the second and third inlets.

## See Also

- [wrap~](/docs/objects/wrap~) - wrap to [0, 1)
- [min~](/docs/objects/min~) - per-sample minimum
- [max~](/docs/objects/max~) - per-sample maximum
