The `tabwrite~` object writes an audio signal into a named buffer
created by `table`.

## Getting Started

Write audio into a buffer:

```
tabwrite~ mybuf
```

The object continuously writes incoming audio samples into the
buffer in a circular fashion.

## Inlets

- **Signal** — audio signal to write
- **Message** — buffer name (string), `bang` (reset write head),
  `stop` / `start` (toggle writing)

## See Also

- [table](/docs/objects/table) — create a named buffer
- [tabread~](/docs/objects/tabread~) — read from a buffer
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
