# Connection Rules

![Connection Rules](/content/images/connection-guide.webp)

These rules define what handles can be connected together.

## Basic Rules

- You can connect multiple outlets to a single inlet and vice-versa
- **Video outlets** (orange) can _only_ connect to video inlets
- **Message outlets** (gray) can _only_ connect to message inlets
- **Audio outlets** (blue) can connect to audio inlets
- **Analysis outlets** (purple) from `fft~` output can connect to message and video inlets

## Audio Parameter Modulation

Audio outlets can connect to _audio parameter_ inlets for parameter modulation:

- `osc~`'s `frequency` and `gain~`'s `gain` are both audio param inlets
- Message _and_ audio outlets (like `osc~` out and `gain~` out) can connect to audio param inlets
- If you start dragging from an audio outlet (blue), the audio param inlets will _turn from grey to blue_ to indicate they're connectable

## Handle Colors

| Color | Type |
|-------|------|
| Orange | Video |
| Blue | Audio |
| Gray | Message |
| Purple | Analysis (FFT) |

## See Also

- [Connecting Objects](/docs/connecting-objects)
- [Video Chaining](/docs/video-chaining)
- [Audio Chaining](/docs/audio-chaining)
