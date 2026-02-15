Pink noise generator. Produces noise with equal energy per octave (-3dB/octave rolloff), sounding more natural than white noise.

## Usage

```txt
pink~ → gain~ → out~
```

Pink noise is useful for testing, masking, and as a modulation source. It has more bass and less treble than white noise.

## See Also

- [noise~](/docs/objects/noise~) - white noise generator
- [osc~](/docs/objects/osc~) - sine wave oscillator
