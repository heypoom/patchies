Slew-limiting low-pass filter that limits how fast a signal can change. Useful for smoothing control signals, creating portamento effects, and preventing clicks from sudden value changes.

## Usage

```txt
phasor~ 1 → *~ 1000 → slop~ → vcf~
                ↑
             limit
```

The limit parameter sets the maximum change per second. A limit of 1000 means the output can change by at most 1000 units per second.

## Parameters

- **limit**: Maximum slew rate in units per second (default: 1)

## Applications

- **Portamento/glide**: Smooth pitch transitions between notes
- **Click prevention**: Prevent sudden jumps in control signals
- **Envelope smoothing**: Soften attack/release transitions
- **Parameter interpolation**: Smooth automation changes

## See Also

- [line~](/docs/objects/line~) - linear ramp generator
- [vcf~](/docs/objects/vcf~) - voltage-controlled filter
