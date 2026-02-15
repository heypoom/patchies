Output the minimum of two signals, sample-by-sample.

## Usage

```
osc~ 440 → min~ ← sig~ 0.5
```

Useful for signal limiting and soft clipping.
Pairs with `max~` for clamping a signal to a range.

Pass a number as a creation argument to set a constant
threshold (e.g. `min~ 0.5`).

## See Also

- [max~](/docs/objects/max~) - per-sample maximum
- [clip~](/docs/objects/clip~) - clamp to range
