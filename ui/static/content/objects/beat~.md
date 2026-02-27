Beat-synced ramp oscillator. Outputs a signal that ramps from 0 to 1 once per beat, synchronized to the global transport BPM. The multiply parameter scales the frequency: `1` = per beat, `2` = per 8th note, `4` = per 16th note, `0.25` = per bar in 4/4.

## Usage

```
beat~ → outputs 0→1 ramp once per beat at current BPM
beat~ 4 → outputs 0→1 ramp four times per beat (16th notes)
beat~ 0.25 → outputs 0→1 ramp once per bar (in 4/4)
```

The ramp automatically follows transport play/pause/stop and BPM changes. When the transport is paused or stopped, the output freezes at its current phase.

## See Also

- [Transport Control](/docs/transport-control) - play/pause, BPM, time display
- [Clock API](/docs/clock-api) - transport-synced scheduling from JS
- [Parameter Automation](/docs/parameter-automation) - automate audio params
- [phasor~](/docs/objects/phasor~) - free-running ramp oscillator (Hz-based)
- [osc~](/docs/objects/osc~) - standard oscillator with waveform types
