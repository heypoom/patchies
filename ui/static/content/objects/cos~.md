Cosine waveshaper. Outputs `cos(2π × input)`.

Converts a phasor signal (0 - 1 ramp) into a cosine wave (-1 to 1).

## Usage

Build a cosine oscillator from a phasor:

```text
[phasor~ 440]
     |
  [cos~]
     |
  [out~]
```

## FM Synthesis

Essential for frequency/phase modulation synthesis:

```text
[phasor~ 440]     [osc~ 100]
     |                |
     |            [*~ 0.5]   <- modulation depth
     |                |
     +-------[+~]-----+
              |
           [cos~]
              |
           [out~]
```

_Inspired by [Pure Data](https://pd.iem.sh/objects/cos~)._

## See Also

- [phasor~](/docs/objects/phasor~) - phase ramp generator
- [osc~](/docs/objects/osc~) - oscillator (uses Web Audio)
- [wrap~](/docs/objects/wrap~) - wrap to 0-1 range
