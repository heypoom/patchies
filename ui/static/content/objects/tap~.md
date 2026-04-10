Capture triggered audio frames and forward them as messages,
enabling waveform data to flow into canvas, GLSL, or any
downstream node.

## Overview

`tap~` uses the same zero-crossing trigger as [scope~](/docs/objects/scope~)
but outputs each captured buffer as a message rather than
rendering it. Connect the outlet to a canvas preset or any
node that can process sample data.

**Waveform mode** sends a `Float32Array` of audio samples.
**XY mode** sends `{ type: 'xy', x: Float32Array, y: Float32Array }`.

## Usage

```
[osc~ 440] → [tap~] → [scope.canvas]
[osc~ 440] → [tap~] → [glsl~]
```

For XY/Lissajous figures, switch to XY mode in the settings
panel and connect two signals:

```
[osc~ 440] ─┐
[osc~ 220] ─┘ [tap~ mode=xy] → [scope-xy.canvas]
```

## Canvas Presets

Two canvas presets work directly with `tap~` output:

- **scope.canvas** — waveform display, accepts `Float32Array`
- **scope-xy.canvas** — XY plot, accepts `{ x, y }` pairs

Both presets accept visual parameter messages on their inlet:
`{ xScale }`, `{ yScale }`, `{ plotType }`, `{ decay }`.

## Settings

- **Samples** (64–2048): Buffer length per frame. Larger values
  capture more of the waveform per trigger.
- **Mode** (waveform / xy): Waveform sends a single array; XY
  sends `{ x, y }` and uses both inlets.
- **Refresh** (0–120 fps): Throttle how often the processor
  triggers. 0 (default) means no limit.

## Trigger Stability

Frames are trigger-synced on rising zero-crossings of the X
(first) inlet signal, giving the same stable display as
`scope~`. If no zero-crossing is found within 2048 samples,
a capture is forced to prevent stalling.

## See Also

- [scope~](/docs/objects/scope~) - self-contained visual oscilloscope
- [snapshot~](/docs/objects/snapshot~) - sample a single value on bang
- [fft~](/docs/objects/fft~) - frequency-domain analysis
- [env~](/docs/objects/env~) - envelope follower
- [meter~](/docs/objects/meter~) - audio level meter
