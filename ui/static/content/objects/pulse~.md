Pulse wave oscillator with pulse width modulation (PWM).

## Usage

```txt
pulse~ 440 → gain~ → out~
```

At width 0.5 (default), produces a square wave. Varying the width changes the harmonic content:

```txt
0.5 → inlet 2 (square wave)
0.1 → inlet 2 (narrow pulse, bright/nasal)
0.9 → inlet 2 (wide pulse, same as 0.1 but inverted)
```

## See Also

- [osc~](/docs/objects/osc~) - sine wave oscillator
- [phasor~](/docs/objects/phasor~) - sawtooth oscillator
