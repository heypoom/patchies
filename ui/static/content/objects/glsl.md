The `glsl` object creates a GLSL fragment shader for complex visual effects and animations. GLSL is a shading language used in OpenGL that runs directly on the GPU.

![GLSL SDF shader](/content/images/patchies-glsl-sdf.png)

> ✨ [Try this patch](/?id=3k3qnwk022tfj7e) featuring a shader from @dtinth's talk, [the power of signed distance functions](https://dt.in.th/SDFTalk)!

## Getting Started

Write GLSL code directly in the editor. The shader runs as a fragment shader:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uv, 0.5, 1.0);
}
```

All shaders on [Shadertoy](https://www.shadertoy.com) are automatically compatible with `glsl`, as they use the same uniforms.

## Video Chaining

Connect any visual objects (`p5`, `hydra`, `glsl`, `swgl`, `canvas`, etc.) to the GLSL object via `sampler2D` video inlets:

```glsl
uniform sampler2D iChannel0;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = texture(iChannel0, uv);
}
```

## Dynamic Uniforms

Define uniforms in your code to create dynamic inlets:

```glsl
uniform float iMix;
uniform vec2 iFoo;
```

This creates two inlets that accept messages. Send `0.5` to `iMix`,
or `[0.0, 1.0]` to `iFoo`.

**Supported types**: `bool`, `int`, `float`, `vec2`, `vec3`, `vec4`

**Default values**: Connect a `loadbang` → `msg` chain to set
initial uniform values when the patch loads.

## Multi-Output (MRT)

Output multiple textures from a single shader pass by declaring
`layout(location=N) out` variables. Each declaration adds a video
outlet to the node.

```glsl
layout(location = 0) out vec4 albedo;
layout(location = 1) out vec4 normals;

void mainImage(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

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

## Mouse Interaction

If your shader uses the `iMouse` uniform (vec4), mouse interaction
is automatically enabled:

- `iMouse.xy`: current mouse position or last click position
- `iMouse.zw`: drag start position
  - Positive when mouse down (ongoing drag)
  - Negative when mouse up (use `abs()` to get last position)

When `iMouse` is detected, the node becomes interactive (drag is disabled to allow mouse input).

## Built-in Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `iResolution` | vec3 | Viewport resolution (width, height, aspect) |
| `iTime` | float | Shader playback time in seconds |
| `iTimeDelta` | float | Time since last frame |
| `iFrame` | int | Current frame number |
| `iMouse` | vec4 | Mouse coordinates |
| `iChannel0-3` | sampler2D | Video input textures |

## Presets

- `red.gl` - solid red color
- `glsl>` - pass through without changes
- `mix.gl` - mix two video inputs
- `overlay.gl` - overlay second input on first
- `fft-freq.gl` - visualize frequency spectrum
- `fft-waveform.gl` - visualize audio waveform
- `switcher.gl` - switch between 6 inputs (send int 0-5)

## Resources

- [The Book of Shaders](https://thebookofshaders.com) - learn GLSL basics
- [Shadertoy](https://www.shadertoy.com) - shader examples and inspiration
- [GLSL Sandbox](http://glslsandbox.com) - more shader experiments

## See Also

- [GLSL Imports](/docs/glsl-imports) - import functions from lygia and other GLSL libraries
- [hydra](/docs/objects/hydra) - live coding visuals
- [swgl](/docs/objects/swgl) - SwissGL shaders
- [p5](/docs/objects/p5) - creative coding with P5.js
