The `table` object creates a named array of floats. It can store
any numerical data — audio samples, lookup tables, sequences,
envelopes, or arbitrary values.

## Getting Started

Create a named array with a size (default 100):

```txt
table mybuf 1024
```

The name is shared — any `tabwrite~`, `tabread~`, or `tabread4~`
using the same name will access the same array.

## See Also

- [tabwrite~](/docs/objects/tabwrite~) — write audio into an array
- [tabread~](/docs/objects/tabread~) — read from an array
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
