Convert frequencies to MIDI note numbers at audio rate.

Uses the formula: `69 + 12 * log2(freq / 440)`

## Usage

Connect a signal containing frequencies in Hz to get the corresponding MIDI note numbers. Output is fractional (e.g., 69.5 for a quarter-tone above A4). Returns 0 for non-positive frequencies.

```
[osc~ 440]    <- A4 frequency
    |
[ftom~]       <- Outputs 69 (MIDI note for A4)
```

Useful for pitch detection, pitch tracking, or analyzing frequency content in terms of musical notes.

_Inspired by [Pure Data](https://pd.iem.sh/objects/ftom~)._

## See Also

- [mtof~](/docs/objects/mtof~) - MIDI to frequency (inverse)
- [osc~](/docs/objects/osc~) - oscillator
