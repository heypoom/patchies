Reciprocal square root (1/√x) of a signal.

Returns 0 for non-positive input values.

## Usage

```
[sig~ 4]
    |
[rsqrt~]      <- Outputs 0.5 (1/√4 = 1/2)
    |
[out~]
```

Commonly used for vector normalization and distance calculations. More efficient than computing `sqrt~` then dividing, as it's a single operation.

## See Also

- [sqrt~](/docs/objects/sqrt~) - square root
- [pow~](/docs/objects/pow~) - power function
- [/~](/docs/objects/divtilde) - divide signals
