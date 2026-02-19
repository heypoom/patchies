The `tabwrite~` object writes an audio signal into a named array
created by `table`.

## Getting Started

Write audio into an array:

```txt
tabwrite~ mybuf
```

The object continuously writes incoming audio samples into the
array in a circular fashion.

_Inspired by [Pure Data](https://pd.iem.sh/objects/tabwrite~)._

## See Also

- [table](/docs/objects/table) — create a named array
- [tabread~](/docs/objects/tabread~) — read from an array
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
