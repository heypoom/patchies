The `tabread~` object reads from a named buffer using an index
signal.

## Getting Started

Read from a buffer using an index:

```txt
tabread~ mybuf
```

The index signal should range from 0 to the buffer length.
Values are read with no interpolation (truncated to integer index).

## See Also

- [table](/docs/objects/table) — create a named array
- [tabwrite~](/docs/objects/tabwrite~) — write audio into a buffer
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
