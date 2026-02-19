Sample and hold unit.

Samples the left input whenever the right input
(control signal) decreases in value — as a phasor~ does each period, for example.

## Usage

Use with a phasor to sample a signal once per cycle:

```txt
noise~ → samphold~
phasor~ → samphold~ → out~
```

This creates a random stepped signal that updates every phasor cycle.

_Inspired by [Pure Data](https://pd.iem.sh/objects/samphold~)._

## See Also

- [snapshot~](/docs/objects/snapshot~) - sample signal on bang
- [phasor~](/docs/objects/phasor~) - sawtooth oscillator (common control signal)
- [noise~](/docs/objects/noise~) - white noise source
