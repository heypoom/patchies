Output the maximum of two signals, sample-by-sample.

## Usage

```
osc~ 440 → max~ ← sig~ -0.5
```

Useful for signal floor limiting.
Pairs with `min~` for clamping a signal to a range.

Pass a number as a creation argument to set a constant
floor (e.g. `max~ -0.5`).

## See Also

- [min~](/docs/objects/min~) - per-sample minimum
- [clip~](/docs/objects/clip~) - clamp to range
