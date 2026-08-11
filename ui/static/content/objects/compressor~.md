A dynamic range compressor that controls audio levels.

## Parameters

- **threshold**: The level where compression starts, in dB. Default: -24.
- **knee**: How smoothly compression starts, in dB. Default: 30.
- **ratio**: The compression ratio. Default: 12.
- **attack**: The attack time, in seconds. Default: 0.003.
- **release**: The release time, in seconds. Default: 0.25.

## Usage

Use a high ratio and a short attack time to limit the signal and prevent clipping.

> **Tip**: Place this object after [expr~](/docs/objects/expr~) or [dsp~](/docs/objects/dsp~). This prevents loud audio spikes.

## See Also

- [gain~](/docs/objects/gain~) controls volume.
- [waveshaper~](/docs/objects/waveshaper~) distorts audio.
