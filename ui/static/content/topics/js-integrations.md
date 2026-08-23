# JS Integrations

## Virtual Filesystem

Load images, videos, fonts, and other files from the patch virtual filesystem:

```javascript
const url = await vfs.getUrl("./my-image.png");
const img = loadImage(url); // works in p5, for example
```

List one folder level or search recursively:

```javascript
const files = await vfs.list(".");
const samples = await vfs.search("kick", "./samples");
const folders = files.filter((entry) => entry.kind === "directory");
```

See [Virtual Filesystem](/docs/virtual-filesystem) to add files to a patch.

## Persistent Storage

Use `kv` to store data after the page reloads:

```javascript
// Save a value
await kv.set("score", 100);

// Read it back later
const score = await kv.get("score"); // 100

// Namespaced stores
const settings = kv.store("settings");
await settings.set("theme", "dark");
```

See [Data Storage](/docs/data-storage) for the full API.

## Audio Reactivity

Connect an `fft~` object to a js object. Then call `fft()` to read the audio analysis data:

```javascript
const analysis = fft({ type: "freq" });

// returns normalized 0-1 float
const bass = analysis.getEnergy("bass");
const treble = analysis.getEnergy("treble");
const firstBin = analysis.f[0];
```

`fft()` returns an `FFTAnalysis` instance. See [Audio Reactivity](/docs/audio-reactivity) for waveforms, raw bins, normalized bins, and examples.

## Primary Button

Each visual object has a primary button beside its overflow menu. The default button uses the `<code>` icon.

For a code-stable patch, you can show the settings panel or a run button. Call `setPrimaryButton()` in the object code:

```javascript
setPrimaryButton('settings'); // gear icon — opens the settings panel
setPrimaryButton('run');      // play icon — re-runs the code
setPrimaryButton('code');     // default — opens the code editor
```

The previous button moves to the overflow menu. You can still select it with one click. The patch saves this choice. See [Object Settings](/docs/object-settings) to set up the settings panel.

For `glsl` shaders, use the comment directive instead:

```glsl
// @primaryButton settings
```

## Output Resolution

By default, visual objects such as `three`, `regl`, `canvas`, and `p5` render at the full window resolution. For data textures or light renders, reduce the texture size:

```javascript
setResolution(256)       // 256×256
setResolution(512, 256)  // 512 wide, 256 tall
setResolution('1/2')     // half resolution
setResolution('1/4')     // quarter resolution
setResolution('1/8')     // any 1/n divisor works
```

Downstream nodes use bilinear filtering to sample the smaller texture. Patchies automatically enlarges it. Use `setTextureFormat('rgba32f')` for GPGPU tasks such as texture-encoded geometry.

> **Note**: GLSL and SwissGL nodes use the `// @resolution 256`
> directive instead of `setResolution()`, see [glsl](/docs/objects/glsl).

## Float Texture Format

By default, visual objects such as `hydra`, `canvas`, `three`, `regl`, `swgl`, and `textmode` output 8-bit RGBA textures. They limit values to 0–1. Call `setTextureFormat()` to use float precision:

```javascript
setTextureFormat('rgba32f');
```

| Format | Precision | Range | Use case |
| -------- | -------- | -------- | -------- |
| `rgba8` | 8-bit | 0–1 | Default. Color, visual output |
| `rgba16f` | 16-bit float | ±65504 | HDR, moderate-precision data |
| `rgba32f` | 32-bit float | full float | GPGPU, physics, positions |

Call this function once when the object starts. Do not call it for each frame. Downstream nodes sample every texture in the same way.

> **Tip**: For `glsl` and `swgl` nodes, you can also use the `// @format rgba32f` comment directive instead.

## Clock & Beat Sync

The `clock` object gives you the global transport for beat-synced animation and scheduling:

```javascript
// Read transport state at any time
clock.time    // seconds elapsed
clock.beat    // current beat (0 to beatsPerBar-1)
clock.phase   // position within current beat (0.0 → 1.0)
clock.bpm     // current tempo

// Run something on every downbeat
clock.onBeat(0, () => {
  background(255); // flash white
});

// Run something every bar
clock.every('1:0:0', () => {
  send({ type: 'bang' });
});
```

See [Clock API](/docs/clock-api) for the full scheduling API.

## AI

Call the configured AI provider from a patch:

```javascript
const result = await llm("Generate a JSON list of 5 colors");
console.log(result);

// Include a visual object's current frame as context
const description = await llm("What's in this frame?", {
  imageNodeId: "canvas-1",
});

// Override the model for a specific call
const haiku = await llm("Write a haiku about recursion", {
  model: "anthropic/claude-haiku-4-5",
});

// Choose which LLM provider to use
// Must be configured in AI provider settings
const haiku = await llm("Write a haiku about recursion", {
  provider: "openrouter"
  // you can also specify the model for the provider here
});
```

An API key is required. Configure the provider with `Ctrl/Cmd + K > AI Provider Settings`.

## Presentation

Make interactive presentation slides with Patchies. Zoom in on specific objects, change backgrounds and pause/unpause objects to keep your presentations dynamic.

Use `Ctrl/Cmd + Shift + C` to copy an object ID.

```javascript
// Pan and zoom the canvas to focus on specific objects
focusObjects({ nodes: [{ id: 'canvas-1' }], duration: 800, padding: 0.3 });

// Set a visual object as the fullscreen background output
setBackgroundOutput('canvas-1');
setBackgroundOutput(null); // clear it

// Pause / unpause objects by ID
pauseObject('p5-1');
unpauseObject('p5-1');
```

## OpenCV

In `js` and `worker` objects, `await opencv()` lazy-loads OpenCV.js and resolves
when its WebAssembly runtime is ready.

```javascript
const cv = await opencv();

const gray = new cv.Mat();

// Use OpenCV, then release every OpenCV allocation.
gray.delete();
```

Use `worker` for CPU-intensive image processing. See the **OpenCV Image Processing**
preset pack for message-based examples.

## See Also

- [JavaScript](/docs/javascript-runner) — Use the core JS API for messages and timers.
- [JS Modules](/docs/js-modules) — Import npm packages and share code between objects.
- [Virtual Filesystem](/docs/virtual-filesystem) — Add and manage patch files.
- [Data Storage](/docs/data-storage) — Use the full `kv` API.
- [Audio Reactivity](/docs/audio-reactivity) — Read the complete FFT guide.
- [Clock API](/docs/clock-api) — Use beat-synced timing and scheduling.
- [Enabling AI](/docs/enabling-ai) — Configure an AI provider.
