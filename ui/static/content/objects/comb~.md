Comb filter with adjustable delay and feedback. Adds a series of equally-spaced resonant peaks to the spectrum.

## Usage

```txt
noise~ → comb~ → gain~ → out~
```

Set delay time (ms) and feedback (-0.999 to 0.999):

```txt
5 → inlet 2 (delay = 5ms, resonant frequency ~200Hz)
0.9 → inlet 3 (high feedback, strong resonance)
```

Short delays create pitched resonances (Karplus-Strong synthesis). Longer delays with moderate feedback create flanging or echo effects.

## See Also

- [delay~](/docs/objects/delay~) - simple delay line
- [allpass~](/docs/objects/allpass~) - allpass filter
- [lowpass~](/docs/objects/lowpass~) - lowpass filter
