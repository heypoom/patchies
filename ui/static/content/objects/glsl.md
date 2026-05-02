The `glsl` object creates a GLSL fragment shader for complex visual effects and animations. GLSL is a shading language used in OpenGL that runs directly on the GPU.

![GLSL SDF shader](/content/images/patchies-glsl-sdf.png)

> ✨ [Try this patch](/?id=3k3qnwk022tfj7e) featuring a shader from @dtinth's
> talk, [the power of signed distance functions](https://dt.in.th/SDFTalk)!

## Getting Started

Write GLSL code directly in the editor. The shader runs as a fragment shader:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(uv, 0.5, 1.0);
}
```

All shaders on [Shadertoy](https://www.shadertoy.com) are automatically
compatible with `glsl`, as they use the same uniforms.

## Video Chaining

Connect any visual objects (`p5`, `hydra`, `glsl`, `swgl`, `canvas`, etc.)
to the  GLSL object via `sampler2D` video inlets:

```glsl
uniform sampler2D image;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = texture(image, uv);
}
```

## Basic Presets

Enable the **GLSL Operators** preset pack for basic presets:

- `glsl>` - a passthrough shader
- `Solid` - solid color with color picker
- `Mix` - mix two video inputs
- `Overlay` - overlay a foreground input on a background input
- `Switcher` - switch between 6 inputs
- `Ramp` - generate linear, radial, and circular ramps
- `Level` - adjust black, white, gamma, brightness, contrast, and opacity
- `Transform` - translate, scale, rotate, and tile an input texture
- `Multiply` - multiply two input textures
- `Blur` - single-pass directional blur
- `Crop` - crop an input texture with optional feathering
- `Reorder` - swizzle color and alpha channels
- `Displace` - warp an input using a displacement texture
- `Edge` - Sobel-style edge detection
- `Noise` - animated procedural noise
- `Noise Displace` - warp an input using procedural noise
- `Feedback` - accumulate an input with a manually wired feedback inlet

The `glsl>` preset is the best starting point for building GLSL shaders
that process video inputs.

For `Feedback`, connect the node's video output back into its `feedback` inlet.
Patchies treats that cable as a one-frame-delayed feedback loop.

## Built-in Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `iResolution` | vec3 | Viewport resolution (width, height, aspect) |
| `iTime` | float | Shader playback time in seconds |
| `iTimeDelta` | float | Time since last frame |
| `iFrame` | int | Current frame number |
| `iMouse` | vec4 | Mouse coordinates |
| `iChannel0-3` | sampler2D | Video input textures |

## Dynamic Uniforms

Define uniforms in your code to create dynamic inlets:

```glsl
uniform float iMix;
uniform vec2 iFoo;
```

This creates two inlets that accept messages. Send `0.5` to `iMix`,
or `[0.0, 1.0]` to `iFoo`.

**Supported types**: `bool`, `int`, `float`, `vec2`, `vec3`, `vec4`,
`mat2`, `mat3`, `mat4`

**Default values**: Connect a `loadbang` → `msg` chain to set
initial uniform values when the patch loads.

## Array Uniforms

Arrays are supported for vector and matrix types:

```glsl
uniform vec2 iPoints[4];
```

Send `[[0.0, 0.0], [0.5, 0.0], [0.5, 1.0], [1.0, 1.0]]` to `iPoints`.

## GLSL Imports

Import functions from [Lygia](https://lygia.xyz) and other
GLSL shader libraries directly in your code:

```glsl
#include <lygia/color/space/rgb2hsv>

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec3 hsv = rgb2hsv(vec3(uv, 0.5));
  fragColor = vec4(hsv, 1.0);
}
```

See [GLSL Imports](/docs/glsl-imports) for how to import from
NPM packages, Lygia, virtual filesystem and external URLs.

## Multi-Output (MRT)

Output multiple textures from a single shader pass by declaring
`layout(location=N) out` variables. Each declaration adds a video
outlet to the node.

```glsl
layout(location = 0) out vec4 albedo;
layout(location = 1) out vec4 normals;

void mainImage(vec2 fragCoord) {
  albedo = vec4(uv, 0.5, 1.0);
  normals = vec4(normalize(vec3(uv - 0.5, 1.0)) * 0.5 + 0.5, 1.0);
}
```

Hit **Run** — the node grows two outlets (`video-out-0`, `video-out-1`).
Connect them to separate downstream nodes. Removing the declarations on
the next run reverts to a single outlet.

> **Note**: In MRT mode the `mainImage` signature changes — no
> `out vec4 fragColor` parameter. Write directly to your named
> output variables instead.

## Audio Reactivity

Enable the **FFT Demos** preset pack for audio-reactive examples:

- `fft-freq.gl` - visualize frequency spectrum
- `fft-waveform.gl` - visualize audio waveform

See the [Audio Reactivity](/docs/audio-reactivity) guide for how to
use waveform and time-domain audio data from [fft~](/docs/objects/fft~)
in your shader.

## Metadata Directives

Add comment directives to customize the node's UI.

### `@title` — Node Title

```glsl
// @title Chromatic Aberration
```

Sets the node's display title instead of the default "glsl".

### `@param` — Ranged Sliders

```glsl
// @param strength 0.01 0.0 0.1 "Aberration strength"
// @param samples 8.0 2.0 32.0 "Sample count"
// @param invert false "Invert output"

uniform float strength; // 0.01
uniform float samples;  // 8.0
uniform bool invert;    // false
```

Format: `// @param <name> [default] [min] [max] ["description"]`

Each `@param` must have a matching `uniform` declaration — the type is
inferred from it.

When `min` and `max` are provided, the settings panel shows a slider instead of
a plain number input. The description replaces the uniform name as the label.

### `@param` — Color Picker

Use `color` as the default value to render a `vec3` uniform as a color picker.
You can also provide a default hex color and a quoted title:

```glsl
// @param tint color
// @param glow color "Glow color"
// @param shadow color #111827 "Shadow color"

uniform vec3 tint;
uniform vec3 glow;
uniform vec3 shadow;
```

Format: `// @param <name> color [#hex] ["title"]`

The color picker stores a hex string (e.g. `#ff8800`) and converts it
to a normalized `vec3` (0–1 per channel) before sending to the shader.

The optional hex value sets the picker default. The optional quoted title
replaces the uniform name as the label in settings.

Only works with `vec3` uniforms — other types ignore the `color` keyword.

### `@param` — Select Options

Add parenthesized `value: label` pairs after the default value to render a
numeric uniform as select buttons:

```glsl
// @param mode 0 (0: Linear, 1: Radial, 2: Circular) "Mode"
uniform float mode;
```

The setting stores the selected option, then sends the numeric value to the
shader uniform. This is useful for discrete modes where a slider would be
confusing.

## Float Texture Format

By default, the output texture uses 8-bit RGBA (values clamped to 0–1).
For GPGPU, HDR, or data that needs float precision, add a format directive:

```glsl
// @format rgba32f

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(5.0, -2.0, 100.0, 1.0);  // values survive unclamped
}
```

| Format | Precision | Range | Use case |
|--------|-----------|-------|----------|
| `rgba8` | 8-bit | 0–1 | Default. Color, visual output |
| `rgba16f` | 16-bit float | ±65504 | HDR, moderate-precision data |
| `rgba32f` | 32-bit float | full float | GPGPU, physics, positions |

Downstream nodes sample float textures the same way — no code changes needed on
the receiving end. The preview thumbnail clamps values for display, but the
actual data on the wire stays float.

## Output Resolution

By default, the output FBO renders at full window resolution. For data
textures, particle position maps, or any shader where you don't need
millions of pixels, set a smaller resolution with the `@resolution`
directive:

```glsl
// @resolution 256
// @format rgba32f

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  fragColor = vec4(uv, sin(iTime), 1.0);  // 256×256 float texture
}
```

| Value      | Node size (at 1080p) | Use case                           |
| ---------- | -------------------- | ---------------------------------- |
| `256`      | 256×256              | Position maps, small data textures |
| `512`      | 512×512              | Medium data textures               |
| `256x128`  | 256×128              | Non-square data                    |
| `1/2`      | 960×540              | Half resolution                    |
| `1/4`      | 480×270              | Quarter resolution                 |
| `1/n`      | output ÷ n           | Any integer divisor (1/3, 1/8…)    |
| *(none)*   | 1920×1080            | Default. Full resolution           |

Downstream nodes sample the texture with bilinear filtering — upscaling
is automatic. Combine with `@format rgba32f` for GPGPU workflows like
texture-encoded geometry.

## Mouse Interaction

If your shader uses the `iMouse` uniform (vec4), mouse interaction
is automatically enabled:

- `iMouse.xy`: current mouse position or last click position
- `iMouse.zw`: drag start position
  - Positive when mouse down (ongoing drag)
  - Negative when mouse up (use `abs()` to get last position)

When `iMouse` is detected, the node becomes interactive (drag is disabled to
allow mouse input).

---

## Resources

- [The Book of Shaders](https://thebookofshaders.com) - learn GLSL basics
- [Shadertoy](https://www.shadertoy.com) - shader examples and inspiration
- [GLSL Sandbox](http://glslsandbox.com) - more shader experiments

## See Also

- [hydra](/docs/objects/hydra) - live coding video synth, supports GLSL
- [regl](/docs/objects/regl) - REGL rendering (custom vertex, multiple draw calls)
- [swgl](/docs/objects/swgl) - SwissGL shaders
- [three](/docs/objects/three) - 3D graphics with Three.js
- [p5](/docs/objects/p5) - creative coding with P5.js
