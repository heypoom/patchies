The `table` object creates a named audio buffer that can be
written to by `tabwrite~` and read from by `tabread~` or `tabread4~`.

## Getting Started

Create a named buffer with a size (in samples):

```
table mybuf 1024
```

The buffer name is shared — any `tabwrite~` or `tabread~` using
the same name will access the same buffer.

## Messages

- `set <index> <value>` — set a sample at the given index
- `get <index>` — get the sample value (outputs on outlet)
- `resize <length>` — resize the buffer (preserves existing data)
- `clear` — fill the buffer with zeros
- `normalize` — normalize the buffer to -1..1 range

## See Also

- [tabwrite~](/docs/objects/tabwrite~) — write audio into a buffer
- [tabread~](/docs/objects/tabread~) — read from a buffer
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
