Convert MIDI note numbers to frequencies at audio rate.

Uses the standard formula: `440 * 2^((note - 69) / 12)`

## Usage

Connect a signal containing MIDI note numbers (0-127) to get the corresponding frequencies in Hz. Useful for building synthesizers where pitch is controlled by MIDI data processed at audio rate.

```
[sig~ 60]     <- Middle C (MIDI note 60)
    |
[mtof~]       <- Outputs 261.63 Hz
    |
[osc~]        <- A4 sine wave
```

_Inspired by [Pure Data](https://pd.iem.sh/objects/mtof~)._

## See Also

- [ftom~](/docs/objects/ftom~) - frequency to MIDI (inverse)
- [mtof](/docs/objects/mtof) - message-rate MIDI to frequency
- [osc~](/docs/objects/osc~) - oscillator
