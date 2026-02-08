Dynamic range compressor for controlling audio levels.

## Parameters

- **threshold**: Level above which compression starts (dB, default: -24)
- **knee**: Softness of the compression curve (dB, default: 30)
- **ratio**: Compression ratio (default: 12)
- **attack**: Attack time in seconds (default: 0.003)
- **release**: Release time in seconds (default: 0.25)

## Usage

Use as a limiter by setting high ratio and fast attack to prevent clipping.

> **Tip**: Place after [expr~](/docs/objects/expr~) or [dsp~](/docs/objects/dsp~)
> to prevent loud audio spikes.

## See Also

- [gain~](/docs/objects/gain~) - volume control
- [waveshaper~](/docs/objects/waveshaper~) - distortion
