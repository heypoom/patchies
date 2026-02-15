The `tabread~` object reads from a named array using an index
signal.

## Getting Started

Read from an array using an index:

```txt
tabread~ mybuf
```

The index signal should range from 0 to the array length.
Values are read with no interpolation (truncated to integer index).

## Example

Write a 440Hz sine into a table, then read it back using a phasor:

```txt
table mybuf 512
osc~ 440 → tabwrite~ mybuf
phasor~ 86 → *~ 512 → tabread~ mybuf → out~
```

`phasor~` ramps 0→1 at 86Hz, `*~` scales to 0→512 (the table
size), and `tabread~` outputs the stored sample at that index.

## See Also

- [table](/docs/objects/table) — create a named array
- [tabwrite~](/docs/objects/tabwrite~) — write audio into an array
- [tabread4~](/docs/objects/tabread4~) — read with interpolation
