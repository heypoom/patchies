Exponential function (e^x) for signals.

## Usage

```
[sig~ 1]
    |
[exp~]        <- Outputs ~2.718 (e^1)
    |
[out~]
```

Useful for creating exponential curves, amplitude envelopes, and frequency scaling. Often paired with `log~` for inverse operations.

**Note:** Large input values produce very large outputs. For audio-rate use, keep inputs in a reasonable range (e.g., -10 to 10).

_Inspired by [Pure Data](https://pd.iem.sh/objects/exp~)._

## See Also

- [log~](/docs/objects/log~) - logarithm (inverse)
- [pow~](/docs/objects/pow~) - power function
