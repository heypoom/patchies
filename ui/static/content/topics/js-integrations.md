# JS Integrations

Call external AI providers, control how objects appear in your patch, and configure GPU texture precision — all from JavaScript.

## Virtual Filesystem

Load images, videos, fonts, and other files from the patch's virtual filesystem:

```javascript
const url = await getVfsUrl("my-image.png");
const img = loadImage(url); // works in p5, for example
```

See [Virtual Filesystem](/docs/virtual-filesystem) for how to add files to your patch.

## Persistent Storage

Use `kv` to store data that survives page reloads:

```javascript
// Save a value
await kv.set("score", 100);

// Read it back later
const score = await kv.get("score"); // 100

// Namespaced stores
const settings = kv.store("settings");
await settings.set("theme", "dark");
```

See [Data Storage](/docs/data-storage) for more.

## Audio Reactivity

Connect an `fft~` object to your js object and call `fft()` to read frequency data:

```javascript
const data = fft(); // Float32Array of frequency values (0–255)
const bass = data[2];
const treble = data[data.length - 10];
```

See [Audio Reactivity](/docs/audio-reactivity) for a full walkthrough.

## Primary Button

Each visual object has a primary button next to its overflow menu; by default it's the `<code>` icon.

For code-stable patches, you might prefer to surface the settings panel or a re-run button instead. Call `setPrimaryButton()` from your object's own code:

```javascript
setPrimaryButton('settings'); // gear icon — opens the settings panel
setPrimaryButton('run');      // play icon — re-runs the code
setPrimaryButton('code');     // default — opens the code editor
```

The displaced button moves into the overflow menu, so it's still one click away. The choice is saved with the patch. See [Object Settings](/docs/object-settings) for how to set up the settings panel.

For `glsl` shaders, use the comment directive instead:

```glsl
// @primaryButton settings
```

## Output Resolution

Visual objects (`three`, `regl`, `canvas`, `p5`, etc.) render at full
window resolution by default. For data textures or lightweight renders,
reduce the texture size:

```javascript
setResolution(256)       // 256×256
setResolution(512, 256)  // 512 wide, 256 tall
setResolution('1/2')     // half resolution
setResolution('1/4')     // quarter resolution
setResolution('1/8')     // any 1/n divisor works
```

Downstream nodes sample the smaller texture with bilinear filtering —
upscaling is automatic. Combine with `setTextureFormat('rgba32f')` for
GPGPU workflows like texture-encoded geometry.

> **Note**: GLSL and SwissGL nodes use the `// @resolution 256`
> directive instead of `setResolution()`, see [glsl](/docs/objects/glsl).

## Float Texture Format

Visual objects (`hydra`, `canvas`, `three`, `regl`, `swgl`, `textmode`) output 8-bit RGBA textures by default, clamping values to 0–1. Call `setTextureFormat()` to switch to float precision:

```javascript
setTextureFormat('rgba32f');
```

| Format | Precision | Range | Use case |
| --- | --- | --- | --- |
| `rgba8` | 8-bit | 0–1 | Default. Color, visual output |
| `rgba16f` | 16-bit float | ±65504 | HDR, moderate-precision data |
| `rgba32f` | 32-bit float | full float | GPGPU, physics, positions |

Call once at init — not per-frame. Downstream nodes sample the texture the same way regardless of format.

> **Tip**: For `glsl` and `swgl` nodes, you can also use the `// @format rgba32f` comment directive instead.

## Clock & Beat Sync

The `clock` object gives you access to the global transport for beat-synced animations and scheduling:

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

See [Clock API](/docs/clock-api) for the full scheduling reference.



## AI

Call the configured AI provider directly from your patch:

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

Requires an API key — configure your provider via `Ctrl/Cmd + K > AI Provider Settings`.

## Presentation

Control how other objects appear in the patch. Use `Ctrl/Cmd + Shift + C` to copy an object's ID, and `Shift + Drag` to select multiple.

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

## See Also

- [JavaScript](/docs/javascript-runner) — Core JS API: messaging, timers, and more
- [JS Modules](/docs/js-modules) — Importing npm packages and sharing code between objects
- [Virtual Filesystem](/docs/virtual-filesystem) — Managing files in your patch
- [Data Storage](/docs/data-storage) — Full `kv` API reference
- [Audio Reactivity](/docs/audio-reactivity) — Full FFT walkthrough
- [Clock API](/docs/clock-api) — Beat-synced timing and scheduling
- [Enabling AI](/docs/enabling-ai) — How to configure an AI provider
