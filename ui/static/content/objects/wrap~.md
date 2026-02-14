Wrap a signal to the [0, 1) range. Values outside the range are wrapped using modular arithmetic.

## Usage

```
phasor~ 440 → *~ 2 → wrap~
```

Essential companion to `phasor~` for phase distortion synthesis. Doubling a phasor and wrapping creates a frequency doubler.

## See Also

- [phasor~](/docs/objects/phasor~) - ramp oscillator
- [clip~](/docs/objects/clip~) - clamp to range
- [abs~](/docs/objects/abs~) - absolute value
