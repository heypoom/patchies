The `tabread~` object reads from a named buffer using an index
signal.

## Getting Started

Read from a buffer using an index:

```
tabread~ mybuf
```

The index signal should range from 0 to the buffer length.
Values are read with no interpolation (truncated to integer index).

## Inlets

- **Signal** — index into the buffer (0 to buffer length)
- **Message** — buffer name (string)

## See Also

- [table](/docs/objects/table) — create a named buffer
- [tabwrite~](/docs/objects/tabwrite~) — write audio into a buffer
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
