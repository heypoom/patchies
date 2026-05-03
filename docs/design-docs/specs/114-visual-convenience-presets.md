# 114. Visual Convenience Presets

## Problem

With `#include <lygia/...>` (spec 118), users have access to hundreds of GLSL utility functions. But using them still requires writing boilerplate: the `#include` directive, uniform declarations, the `mainImage` wrapper, and knowing which lygia path to use. For common operations (noise generator, blur, color grading), users shouldn't need to write 8-15 lines of scaffolding every time. The shader effect format (spec 123) provides drag-drop scaffolding for effects, but presets cover the broader case of pre-configured nodes across all visual node types.

## Approach

Ship **presets** for existing node types (GLSL, SwissGL, Three.js) that wrap lygia functions with pre-configured uniforms and settings sliders. Each preset is a thin wrapper — the actual GLSL logic comes from lygia. Users can fork/edit the generated code.

No new node types. Presets are code templates.

### Preset Categories

#### Procedural Generators (GLSL presets)

GLSL node presets that `#include` lygia generators with key parameters exposed as uniform sliders:

| Preset | lygia include | Uniforms | Notes |
|--------|--------------|----------|-------|
| `simplex-noise` | `<lygia/generative/snoise>` | scale, speed | 2D/3D simplex noise |
| `voronoi` | `<lygia/generative/worley>` | scale, jitter, speed | Worley noise variants |
| `fbm` | `<lygia/generative/fbm>` | scale, octaves, lacunarity, gain | Fractal Brownian motion |
| `gradient` | (simple, no lygia needed) | direction, color stops | Linear/radial/angular |
| `checkerboard` | (simple, no lygia needed) | scale, color1, color2 | Basic pattern |
| `perlin-warp` | `<lygia/generative/snoise>` | scale, warp amount, octaves | Domain warping |

**Example preset** — `fbm` generator:

```glsl
#include <lygia/generative/fbm>
uniform float scale;      // 4.0
uniform int octaves;      // 5
uniform float lacunarity; // 2.0
uniform float gain;       // 0.5

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float n = fbm(uv * scale + iTime * 0.1);
    fragColor = vec4(vec3(n), 1.0);
}
```

Hydra already has `noise()` and `voronoi()` — these GLSL presets offer more control and float-precision output (relevant once spec 112 lands).

#### Utility Processors (GLSL presets)

Take one or more input textures and transform them:

| Preset | Inputs | lygia include | Notes |
|--------|--------|--------------|-------|
| `normal-from-height` | height map | `<lygia/filter/normalMap>` | Height → normal map |
| `channel-split` | RGBA texture | (simple) | R, G, B, A separate. Needs MRT (spec 111) |
| `channel-merge` | up to 4 textures | (simple) | Combine separate channels |
| `blend-modes` | 2 textures | `<lygia/color/blend>` | Multiply, screen, overlay, etc. |
| `levels` | texture | `<lygia/color/levels>` | Black point, white point, gamma |
| `edge-detect` | texture | `<lygia/filter/edge>` | Sobel operator |
| `blur` | texture | `<lygia/filter/gaussianBlur>` | Gaussian blur |
| `displacement` | texture + disp map | (simple) | UV offset from displacement |
| `mask` | source + mask | (simple) | Clip source alpha by another texture's alpha, useful with shape presets |
| `sharpen` | texture | `<lygia/filter/sharpen>` | Unsharp mask |

#### PBR / Lighting (Three.js presets)

Three.js presets that take texture inputs and render lit geometry:

| Preset | Inputs | Description |
|--------|--------|-------------|
| `pbr-sphere` | albedo, normal, roughness, metallic | Lit sphere preview (Substance-style) |
| `pbr-plane` | same | Lit plane for texture preview |
| `material-preview` | N inputs via `@slot` metadata | Generic material previewer (spec 123) |
| `geometry-viewer` | geometry inlet | 3D preview of geometry data (spec 115) |

These become much more useful once MRT (spec 111) lets a single GLSL node output albedo + normal + roughness as separate wires.

#### Feedback Templates (GLSL/SwissGL presets)

Ready-made feedback patterns (useful now within single nodes, more powerful with spec 113):

| Preset | Description |
|--------|-------------|
| `trail` | Fade accumulation (classic feedback trail) |
| `reaction-diffusion` | Gray-Scott model |
| `fluid-sim` | Navier-Stokes step |
| `game-of-life` | Cellular automaton |
| `particle-sim` | Position + velocity ping-pong |

#### Geometry (JS presets, spec 115)

JS node presets that produce/transform geometry via `send()`:

| Preset | Description |
|--------|-------------|
| `geo.sphere` | Sphere generator with radius/segments sliders |
| `geo.box` | Box generator with width/height/depth sliders |
| `geo.plane` | Plane generator with size/segments sliders |
| `geo.torus` | Torus generator with radius/tube/segments sliders |
| `geo.transform` | Translate/rotate/scale with sliders |
| `geo.merge` | Combine multiple geometry inputs |
| `geo.scatter` | Distribute points on a surface |
| `geo.instance` | Instance geometry at point positions |

### Implementation

#### Preset Files

Add to existing preset directories:

- `src/lib/presets/builtin/glsl-generators.presets.ts`
- `src/lib/presets/builtin/glsl-utilities.presets.ts`
- `src/lib/presets/builtin/three-pbr.presets.ts`
- `src/lib/presets/builtin/swgl-simulation.presets.ts`
- `src/lib/presets/builtin/geo.presets.ts`

Follow existing preset format (see `src/lib/presets/builtin/`).

Keep per-frame `render()` work lean. Derived values from rarely changed settings
(for example parsed color strings) should be cached and recomputed only when the
setting value changes.

#### Preset Packs

Register in `src/lib/extensions/preset-packs.ts`. Suggested packs:

- **Procedural** — noise, voronoi, fbm, gradient, patterns
- **Image Processing** — blur, levels, edge detect, blend modes, channel ops
- **PBR / Lighting** — Three.js lighting presets, material preview
- **Simulation** — reaction-diffusion, fluid, particles, cellular automata
- **Geometry** — primitives, transforms, scatter, instancing

#### Object Browser

Add presets to categorized objects so they appear in the insert palette. Users see them alongside nodes — picking a preset creates the node with preset code pre-loaded.

### Dependencies on Other Specs

- `channel-split` needs MRT (spec 111) to output separate channels
- `blur` multi-pass needs graph feedback (spec 113) or internal ping-pong
- `particle-sim` benefits from float FBOs (spec 112) for position precision
- PBR presets become a full pipeline when combined with MRT + resource pool (spec 117)
- Geometry presets require geometry handle type (spec 115)
- All GLSL presets require `#include` preprocessor (spec 118) for lygia imports
- Most presets have no hard deps — they work today, just get better as other specs land
