Output the maximum of two signals, sample-by-sample.

## Usage

```
osc~ 440 → max~ ← sig~ -0.5
```

Useful for signal floor limiting. Pairs with `min~` for clamping a signal to a range.

## See Also

- [min~](/docs/objects/min~) - per-sample minimum
- [clip~](/docs/objects/clip~) - clamp to range
