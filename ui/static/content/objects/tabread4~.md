The `tabread4~` object reads from a named buffer using 4-point
Hermite interpolation for smooth playback.

## Getting Started

Read from a buffer with interpolation:

```txt
tabread4~ mybuf
```

The index signal can be fractional — the output is interpolated
between neighboring samples using Hermite cubic interpolation.
This produces smoother results than `tabread~` when the index
changes at sub-sample rates.

## See Also

- [table](/docs/objects/table) — create a named array
- [tabwrite~](/docs/objects/tabwrite~) — write audio into a buffer
- [tabread~](/docs/objects/tabread~) — read without interpolation
