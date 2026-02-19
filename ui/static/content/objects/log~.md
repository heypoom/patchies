Natural logarithm (ln) of a signal.

Returns 0 for non-positive input values.

## Usage

```
[sig~ 2.718]
    |
[log~]        <- Outputs ~1 (ln(e) = 1)
    |
[out~]
```

Useful for converting exponential curves to linear, decibel calculations, and frequency scaling. Often paired with `exp~` for inverse operations.

## See Also

- [exp~](/docs/objects/exp~) - exponential (inverse)
- [pow~](/docs/objects/pow~) - power function
- [*~](/docs/objects/*~) - multiply signals
