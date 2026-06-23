Capture audio frames and forward them as messages, enabling
waveform data to flow into canvas, GLSL, or any downstream node.

## Overview

`tap~` can use the same zero-crossing trigger as
[scope~](/docs/objects/scope~), but it outputs each captured
buffer as a message rather than rendering it. Connect the outlet
to a canvas preset or any node that can process sample data.

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
- **scope-xy.canvas** — XY plot, accepts
  `{ type: 'xy', x: Float32Array, y: Float32Array }`

Both presets are available in the **Scope Demos** preset pack.
Visual parameters (xScale, yScale, plotType, decay) are
configurable via the settings panel on each preset.

## Settings

- **Samples** (64–2048): Buffer length per frame. Larger values
  capture more of the waveform per trigger.
- **Mode** (waveform / xy): Waveform sends a single array; XY
  sends `{ x, y }` and uses both inlets.
- **FPS Limit** (0–120 fps): Throttle how often the processor
  captures. 0 (default) means no limit.
- **Zero Crossing**: When enabled, captures start on rising
  zero-crossings for stable scope-style frames. Disable it for
  continuous monitoring when you do not need waveform locking.

## Trigger Stability

When zero-crossing detection is enabled, frames are trigger-synced
on rising zero-crossings of the X (first) inlet signal, giving the
same stable display behavior as `scope~`. If no zero-crossing is
found within 4096 samples, a capture is forced to prevent stalling.

When zero-crossing detection is disabled, `tap~` continuously
captures frames as soon as the FPS limit allows.

## See Also

- [scope~](/docs/objects/scope~) - self-contained visual oscilloscope
- [snapshot~](/docs/objects/snapshot~) - sample a single value on bang
- [fft~](/docs/objects/fft~) - frequency-domain analysis
- [env~](/docs/objects/env~) - envelope follower
- [meter~](/docs/objects/meter~) - audio level meter
