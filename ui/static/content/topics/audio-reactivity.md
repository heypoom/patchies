# Audio Reactivity

![Audio reactive visualization](/content/images/patchies-audio-reactive.png)

> ✨ [Try this patch](/?id=sgov4pl7f9ku4h7) with audio-reactive visuals!

The `fft~` audio object gives you an array of frequency bins that you can use to create visualizations in your patch.

## Getting Started

1. Create a `fft~` object with bin size (e.g., `fft~ 1024`)
2. Connect the purple "analyzer" outlet to a visual object's inlet

Supported objects: `glsl`, `swgl`, and any objects using the [JavaScript Runner](/docs/javascript-runner) like `canvas.dom`, `hydra`, and more.

## Usage with GLSL

1. Create a `sampler2D` GLSL uniform inlet
2. Connect the purple "analyzer" outlet of `fft~` to it
3. Try the `fft-freq.gl` and `fft-waveform.gl` presets

For waveform (time-domain) instead of frequency analysis, name the uniform exactly `uniform sampler2D waveTexture;`.

## Usage with JavaScript Objects

Call the `fft()` function to get audio analysis data:

```javascript
// Frequency spectrum
fft({ type: 'freq' })

// Waveform (default)
fft()  // or fft({ type: 'wave' })
```

**Important**: Patchies does NOT use standard Hydra/P5.js audio APIs. Use `fft()` instead.

## FFTAnalysis Properties

The `fft()` function returns an `FFTAnalysis` instance:

| Property/Method | Description |
|-----------------|-------------|
| `fft().a` | Raw frequency bins (Uint8Array) |
| `fft().f` | Normalized bins (Float32Array, 0-1) |
| `fft().rms` | RMS level (float) |
| `fft().avg` | Average level (float) |
| `fft().centroid` | Spectral centroid (float) |
| `fft().getEnergy('bass')` | Energy in frequency range (0-255) |

Frequency ranges: `bass`, `lowMid`, `mid`, `highMid`, `treble`

Custom range: `fft().getEnergy(40, 200) / 255`

## Where to Call fft()

- **p5**: in your `draw` function
- **canvas/canvas.dom**: in `requestAnimationFrame` callback
- **js**: in `setInterval` or `requestAnimationFrame`
- **hydra**: inside arrow functions for dynamic parameters

```javascript
// Hydra example
let a = () => fft().getEnergy("bass") / 255;
osc(10, 0, () => a() * 4).out()
```

## Presets

- `fft.hydra` - Hydra audio visualization
- `fft.p5`, `fft-sm.p5`, `rms.p5` - P5.js visualizations
- `fft.canvas` - Fast canvas visualization (uses `canvas.dom`)

## Performance Tips

- Use `canvas.dom` or `p5` for instant FFT reactivity
- Worker-based `canvas` has slight delay but better video chaining performance

## Converting Existing Code

### From Hydra

```diff
- osc(10, 0, () => a.fft[0]*4)
+ osc(10, 0, () => fft().f[0]*4)
  .out()
```

- Replace `a.fft[0]` with `fft().a[0]` (int 0-255) or `fft().f[0]` (float 0-1)
- Instead of `a.setBins(32)`, set bins in `fft~` object: `fft~ 32`

### From P5.js

| P5.js | Patchies |
|-------|----------|
| `p5.Amplitude` | `fft().rms` |
| `p5.FFT` | `fft()` |
| `fft.analyze()` | (not needed) |
| `fft.waveform()` | `fft({ format: 'float' }).a` |
| `fft.getEnergy('bass')` | `fft().getEnergy('bass') / 255` |
| `fft.getCentroid()` | `fft().centroid` |

## See Also

- [JavaScript Runner](/docs/javascript-runner) - API reference
- [Video Chaining](/docs/video-chaining) - Connect visual objects
- [Rendering Pipeline](/docs/rendering-pipeline) - Performance details
