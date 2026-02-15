The `tabwrite~` object writes an audio signal into a named buffer
created by `table`.

## Getting Started

Write audio into a buffer:

```txt
tabwrite~ mybuf
```

The object continuously writes incoming audio samples into the
buffer in a circular fashion.

## See Also

- [table](/docs/objects/table) — create a named array
- [tabread~](/docs/objects/tabread~) — read from a buffer
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
