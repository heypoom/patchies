# Audio Reactivity

Use the `fft~` audio object to get frequency-bin arrays for visualizations in a patch.

![Audio reactive visualization](/content/images/patchies-audio-reactive.png)

This patch uses audio data to control its visuals.

> ✨ [Try this patch](/?src=/demos/audio-reactive-circle.json) with audio-reactive visuals!

## Getting Started

1. Create an `fft~` object with a bin size, for example `fft~ 1024`.
2. Connect its purple analyzer outlet to a visual-object inlet.

`glsl` supports this connection. Objects that use the [JavaScript Runner](/docs/javascript-runner), such as `canvas.dom` and `hydra`, also support it.

## Usage with GLSL

1. Create a `sampler2D` GLSL uniform inlet.
2. Connect the `fft~` purple analyzer outlet to the inlet.
3. Try the `FFT Frequency GL` and `FFT Waveform GL` presets.

For waveform analysis instead of frequency analysis, name the uniform exactly `uniform sampler2D waveTexture;`.

## Usage with JavaScript Objects

Call `fft()` to get audio-analysis data:

```javascript
// Frequency spectrum
fft({ type: 'freq' })

// Waveform (default)
fft()  // or fft({ type: 'wave' })
```

> **Important**: Patchies does not use the standard Hydra or P5.js audio APIs. Use `fft()` instead.

## FFTAnalysis Properties

`fft()` returns an `FFTAnalysis` instance:

| Property/Method | Description |
| --------------- | ----------- |
| `fft().a` | Raw bins in a Uint8Array. |
| `fft().f` | Normalized bins in a Float32Array, from 0 to 1. |
| `fft().rms` | RMS amplitude from 0 to 1. It uses the time-domain signal for `wave` mode and spectral energy for `freq` mode. |
| `fft().avg` | Average level. |
| `fft().centroid` | Spectral centroid. |
| `fft().getEnergy('bass')` | Energy in a frequency range, from 0 to 1. |

Use these frequency ranges: `bass`, `lowMid`, `mid`, `highMid`, and `treble`.

For a custom range, use `fft().getEnergy(40, 200)`.

## Where to Call fft()

- **p5**: Call it in `draw`.
- **canvas/canvas.dom**: Call it in a `requestAnimationFrame` callback.
- **js**: Call it in `setInterval` or `requestAnimationFrame`.
- **hydra**: Call it in arrow functions for dynamic parameters.

```javascript
// Hydra example
let a = () => fft().getEnergy("bass");
osc(10, 0, () => a() * 4).out()
```

## Presets

- `fft.hydra` — A Hydra audio visualization.
- `fft.p5`, `fft-sm.p5`, `rms.p5` — P5.js visualizations.
- `fft.canvas` — A canvas visualization that uses `canvas.dom`.

## Performance Tips

- Use `canvas.dom` or `p5` for immediate FFT response.
- Worker-based `canvas` has a short delay but improves video-chaining performance.

## Converting Existing Code

### From Hydra

```diff
- osc(10, 0, () => a.fft[0]*4)
+ osc(10, 0, () => fft().f[0]*4)
  .out()
```

- Replace `a.fft[0]` with `fft().a[0]` for integers from 0 to 255. Use `fft().f[0]` for floats from 0 to 1.
- Instead of `a.setBins(32)`, set the bin count in the `fft~` object: `fft~ 32`.

### From P5.js

| P5.js | Patchies |
| ----- | -------- |
| `p5.Amplitude` | `fft().rms` |
| `p5.FFT` | `fft()` |
| `fft.analyze()` | (not needed) |
| `fft.waveform()` | `fft({ format: 'float' }).a` |
| `fft.getEnergy('bass')` | `fft().getEnergy('bass')` |
| `fft.getCentroid()` | `fft().centroid` |

## See Also

- [JavaScript Runner](/docs/javascript-runner) — Use the JavaScript API.
- [Video Chaining](/docs/video-chaining) — Connect visual objects.
- [Rendering Pipeline](/docs/rendering-pipeline) — Learn about rendering performance.
- [env~](/docs/objects/env~) — Follow audio loudness with an envelope.
- [tap~](/docs/objects/tap~) — Send waveform frames as messages to custom visualizers.
- [scope~](/docs/objects/scope~) — Show an audio waveform.
- [meter~](/docs/objects/meter~) — Show an audio level.
