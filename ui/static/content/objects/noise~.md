White noise generator. Outputs random values between -1 and 1 at audio rate.

## Usage

```
noise~ → gain~ → out~
```

Each sample is an independent uniform random value. Useful for percussion synthesis, testing, and as a modulation source.

## See Also

- [osc~](/docs/objects/osc~) - oscillator
- [sig~](/docs/objects/sig~) - constant signal
