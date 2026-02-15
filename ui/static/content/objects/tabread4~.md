The `tabread4~` object reads from a named array using 4-point
Hermite interpolation for smooth playback.

## Getting Started

Read from an array with interpolation:

```txt
tabread4~ mybuf
```

The index signal can be fractional — the output is interpolated
between neighboring samples using Hermite cubic interpolation.
This produces smoother results than `tabread~` when the index
changes at sub-sample rates.

## See Also

- [table](/docs/objects/table) — create a named array
- [tabwrite~](/docs/objects/tabwrite~) — write audio into an array
- [tabread~](/docs/objects/tabread~) — read without interpolation
