Square root of a signal.

Returns 0 for negative input values (real square root only).

## Usage

```
[sig~ 4]
    |
[sqrt~]       <- Outputs 2
    |
[out~]
```

Useful for amplitude calculations, distance computations, and signal shaping. Often combined with other math operators.

## See Also

- [pow~](/docs/objects/pow~) - power function
- [abs~](/docs/objects/abs~) - absolute value
- [*~](/docs/objects/*~) - multiply signals
