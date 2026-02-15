Sawtooth ramp oscillator. Outputs a signal that ramps from 0 to 1 at the given frequency. The right inlet resets the phase with values from 0 to 1.

## Usage

```
440 → phasor~ → outputs sawtooth ramp 0→1 at 440 Hz
```

Useful as a phase source for waveshaping, FM synthesis, or driving other signal processors. Positive frequency values generate upwards ramps and negative values generate downwards ramps.

## See Also

- [osc~](/docs/objects/osc~) - standard oscillator with waveform types
- [line~](/docs/objects/line~) - signal ramp generator
