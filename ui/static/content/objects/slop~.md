Slew-limiting low-pass filter that limits how fast a signal can change. Useful for smoothing control signals, creating portamento effects, and preventing clicks from sudden value changes.

## Usage

```txt
[osc~ 440] → [slop~ 10000] → [gain~ 0.3] → [out~]
```

The limit parameter sets the maximum change per second. Use a high limit for audio-rate signals: a limit of `10000` preserves an audible 440 Hz tone while softening abrupt changes.

To smooth a filter sweep, connect `slop~` to the `frequency` inlet of [vcf~](/docs/objects/vcf~), alongside a separate audio signal connected to `vcf~`'s first inlet.

## Parameters

- **limit**: Maximum slew rate in units per second (default: 1). Values near 1 are intended for slow control signals; use larger values for audio.

## Applications

- **Portamento/glide**: Smooth pitch transitions between notes
- **Click prevention**: Prevent sudden jumps in control signals
- **Envelope smoothing**: Soften attack/release transitions
- **Parameter interpolation**: Smooth automation changes

## See Also

- [line~](/docs/objects/line~) - linear ramp generator
- [vcf~](/docs/objects/vcf~) - voltage-controlled filter
