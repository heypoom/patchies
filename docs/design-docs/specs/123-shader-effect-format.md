# 123. Shader Effect Format

## Problem

With `#include` (spec 118), users can import GLSL functions. But there's no standard way to package reusable shader effects with metadata — type inference, drag-drop scaffolding, material slots, or Hydra integration. Users still need to manually write boilerplate wrappers every time they use an effect function.

## Solution

Annotated GLSL functions with optional metadata, stored in VFS. Usable as include-able functions AND as drag-drop scaffolding for creating pre-configured GLSL nodes. Not a new node type.

## What It Is

Effects are GLSL functions stored in VFS that can be:

1. Included via `#include "user://effects/..."` in any shader
2. **Drag-dropped** from the VFS sidebar onto a shader node — inserts the `#include` directive
3. **Drag-dropped** onto empty canvas — creates a GLSL node with auto-generated wrapper code

**No metadata is required.** The scaffold generator infers everything from the function signature. Optional metadata annotations can override or enrich the inferred values.

## Effect Definition

An effect is just a GLSL function. Metadata is optional:

```glsl
// Minimal — no metadata needed, everything inferred from signature
vec4 chromaticAberration(vec2 uv, sampler2D input, float strength, float samples) {
    vec4 sum = vec4(0.0);
    for (float i = 0.0; i < samples; i++) {
        float t = i / (samples - 1.0);
        vec2 offset = (t - 0.5) * strength * vec2(1.0, 0.0);
        sum.r += texture(input, uv + offset).r;
        sum.g += texture(input, uv).g;
        sum.b += texture(input, uv - offset).b;
    }
    sum.rgb /= samples;
    sum.a = 1.0;
    return sum;
}
```

With optional metadata for richer UX:

```glsl
// @title Chromatic Aberration
// @type effect
// @param float strength 0.01 0.0 0.1 "Aberration strength"
// @param float samples 8.0 2.0 32.0 "Sample count"

vec4 chromaticAberration(vec2 uv, sampler2D input, float strength, float samples) {
    // ... same code
}
```

## Inference Rules

The scaffold generator parses the function signature to determine everything automatically:

**Type inference** (from function signature):

| Return type | sampler2D params | First non-uv param | Inferred type |
| ----------- | ---------------- | ------------------ | ------------- |
| `vec4`      | 0                | —                  | `generator`   |
| `vec4`      | 1                | `sampler2D`        | `effect`      |
| `vec4`      | 2                | `sampler2D`        | `combiner`    |
| `vec2`      | any              | —                  | `coordinate`  |
| `vec4`      | 0                | `vec4`             | `color`       |

**Inlet inference**: Count `sampler2D` params — that many video inlets (`iChannel0`, `iChannel1`, ...).

**Uniform inference**: Non-sampler, non-uv, non-time params become `uniform` declarations. The existing GLSL node uniform parser then creates settings sliders from those declarations.

**Wrapper inference**: The `mainImage` body is mechanical — call the function, passing `uv`, `iChannelN` for samplers, uniform names for the rest.

## Optional Metadata

All annotations are optional overrides. If absent, values are inferred.

`@title` and `@param` are defined in [spec 125](125-glsl-metadata-directives.md) and work in any GLSL node — they don't require the effect system.

This spec adds effect-specific directives on top:

```
// @title human-readable name         (spec 125 — works in any GLSL node)
// @param <type> <name> <default> [min] [max] ["description"]  (spec 125 — works in any GLSL node)
// @type generator|effect|combiner|coordinate|color|material  (default: inferred from signature)
// @slot <type> <name> ["description"]  (material slots with semantic meaning)
// @depend <include_path>              (auto-includes another file)
```

`@type` is useful when inference is ambiguous or when you want to force a specific category for browsing/Hydra integration.

`@param` is useful for range-constrained sliders — without it, the slider works but uses a generic range.

`@slot` is for materials — declares that a parameter has a standard semantic role (see Material Type below).

## Effect Types

| Type         | Signature                                                              | Inlets             | Description                          |
| ------------ | ---------------------------------------------------------------------- | ------------------ | ------------------------------------ |
| `generator`  | `vec4 fn(vec2 uv, float time, ...)`                                    | 0 video            | Produces color from UV + time        |
| `effect`     | `vec4 fn(vec2 uv, sampler2D input, ...)`                               | 1 video            | Transforms one texture               |
| `combiner`   | `vec4 fn(vec2 uv, sampler2D a, sampler2D b, ...)`                      | 2 video            | Blends two textures                  |
| `coordinate` | `vec2 fn(vec2 uv, ...)`                                                | 1 video            | Transforms UV coordinates            |
| `color`      | `vec4 fn(vec4 color, ...)`                                             | 1 video            | Transforms a color value             |
| `material`   | `vec4 fn(vec2 uv, sampler2D albedo, ..., vec3 lightDir, vec3 viewDir)` | N video (per slot) | Shading function with semantic slots |

## Material Type

A `material` is an effect with **semantic slots** — parameters whose meaning is standardized so that tools (preview UI, Three.js integration, AI, render nodes) can be smart about them.

### Definition

```glsl
// @type material
// @slot sampler2D albedo "Base Color"
// @slot sampler2D normal "Normal Map"
// @slot float roughness 0.5 0.0 1.0 "Roughness"
// @slot float metallic 0.0 0.0 1.0 "Metallic"
// @slot sampler2D emissive "Emissive Map"
// @slot sampler2D ao "Ambient Occlusion"

#include <lygia/lighting/pbr>

vec4 pbrStandard(vec2 uv, sampler2D albedo, sampler2D normal,
                 float roughness, float metallic,
                 sampler2D emissive, sampler2D ao,
                 vec3 lightDir, vec3 viewDir) {
    vec3 N = texture(normal, uv).rgb * 2.0 - 1.0;
    vec3 baseColor = texture(albedo, uv).rgb;
    float occlusion = texture(ao, uv).r;
    vec3 col = pbr(N, viewDir, lightDir, baseColor, roughness, metallic);
    col *= occlusion;
    col += texture(emissive, uv).rgb;
    return vec4(col, 1.0);
}
```

Note: the material function itself uses `#include <lygia/lighting/pbr>` — no Patchies-maintained lighting code.

### `@slot` vs `@param`

`@param` is a generic tweakable value — no semantic meaning beyond the name.

`@slot` declares a **material property** with a standard role. This tells tools:

- The material preview UI should label this inlet "Albedo" not "iChannel0"
- A Three.js node should wire this to `MeshStandardMaterial.map`, not an arbitrary uniform
- AI should know that "albedo" means base color and generate accordingly
- Render nodes (spec 115) can auto-map slots to material properties

### Standard Slot Names

| Slot name   | Type                   | Three.js property            | Description              |
| ----------- | ---------------------- | ---------------------------- | ------------------------ |
| `albedo`    | `sampler2D`            | `map`                        | Base color texture       |
| `normal`    | `sampler2D`            | `normalMap`                  | Tangent-space normal map |
| `roughness` | `sampler2D` or `float` | `roughnessMap` / `roughness` | Surface roughness        |
| `metallic`  | `sampler2D` or `float` | `metalnessMap` / `metalness` | Metalness                |
| `emissive`  | `sampler2D`            | `emissiveMap`                | Self-illumination        |
| `ao`        | `sampler2D`            | `aoMap`                      | Ambient occlusion        |
| `height`    | `sampler2D`            | `displacementMap`            | Height/displacement      |
| `opacity`   | `sampler2D` or `float` | `alphaMap` / `opacity`       | Transparency             |

These names match both PBR convention and Three.js property names, making the mapping mechanical.

### Drag-Drop Behavior for Materials

**Drop onto empty canvas** — creates a GLSL node with:

- Video inlets labeled by slot name (Albedo, Normal, Roughness, etc.)
- Uniform sliders for float slots with default values
- Auto-generated `mainImage` calling the material function
- A basic directional light + camera-relative view direction

**Drop onto a Three.js node** — generates `MeshStandardMaterial` setup code:

```javascript
const material = new THREE.MeshStandardMaterial()

// Auto-mapped from @slot metadata
if (getTexture(0)) material.map = getTexture(0) // albedo
if (getTexture(1)) material.normalMap = getTexture(1) // normal
material.roughness = settings.roughness ?? 0.5
material.metalness = settings.metallic ?? 0.0
if (getTexture(2)) material.emissiveMap = getTexture(2) // emissive
```

**Material preview preset** — a Three.js node preset that:

- Reads `@slot` metadata to create correctly-labeled inlets
- Renders a sphere/cube with the material applied
- Has settings for preview shape (sphere, cube, plane, custom geometry via spec 115)
- Has settings for lighting environment (from resource pool via spec 117, or built-in presets: studio, outdoor, dramatic)
- Supports orbit camera interaction

Since the slot names are standardized, the preview preset doesn't need to know which specific material is connected — it just maps slots to `MeshStandardMaterial` properties by name.

### Built-In Materials

Materials stored in VFS, using lygia for lighting math:

| Material        | Description                               | Key slots                                         |
| --------------- | ----------------------------------------- | ------------------------------------------------- |
| `pbr-standard`  | Standard PBR (GGX/Smith)                  | albedo, normal, roughness, metallic, emissive, ao |
| `pbr-clearcoat` | Clearcoat layer (car paint, wet surfaces) | + clearcoat, clearcoatRoughness                   |
| `toon`          | Cel shading with configurable steps       | albedo, normal, + steps, edgeThreshold            |
| `matcap`        | Matcap lookup shading                     | matcapTexture                                     |
| `glass`         | Refraction + fresnel                      | albedo, normal, + ior, thickness                  |
| `unlit`         | No lighting, just texture output          | albedo, emissive, opacity                         |

### Hot-Swappable Materials

Since all PBR materials share the same standard slot names, they're interchangeable. Wire albedo + normal + roughness into `pbr-standard`, then swap to `toon` — the same texture connections just work. The toon shader reads albedo and normal the same way, just shades differently.

## Drag-Drop Behavior

### Drop onto existing shader node

Inserts the `#include` directive at the top of the node's code. The user then calls the function in their own code. This works for GLSL, SwissGL, REGL, and Three.js nodes.

### Drop onto empty canvas

Creates a new GLSL node with auto-generated code. The scaffold is inferred from the function signature (with optional metadata overrides):

For an `effect` type like `chromatic-aberration`:

```glsl
#include "user://effects/chromatic-aberration.glsl"
uniform float strength; // 0.01
uniform float samples;  // 8.0

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    fragColor = chromaticAberration(uv, iChannel0, strength, samples);
}
```

For a `generator` type:

```glsl
#include "user://effects/fbm-noise.glsl"

uniform float scale;    // 4.0
uniform int octaves;    // 5

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float n = fbm(uv * scale, octaves, 2.0, 0.5);
    fragColor = vec4(vec3(n), 1.0);
}
```

For a `combiner` type (node gets 2 video inlets):

```glsl
#include "user://effects/blend-modes.glsl"

uniform float mix_amount; // 0.5

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 a = texture(iChannel0, uv);
    vec4 b = texture(iChannel1, uv);
    fragColor = blendScreen(a, b, mix_amount);
}
```

For a `coordinate` type (wraps in texture sample):

```glsl
#include "user://effects/barrel-distort.glsl"

uniform float distortion; // 0.3

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 warped = barrel(uv, distortion);
    fragColor = texture(iChannel0, warped);
}
```

The generated code is fully editable — it's a normal GLSL node. The user can modify it, add logic, combine multiple effects. The scaffold is a starting point, not a locked template.

## Using Effects as Functions in Code

Since effects are just GLSL functions included via `#include`, they compose naturally inside any shader:

```glsl
#include "user://effects/chromatic-aberration.glsl"
#include "user://effects/vignette.glsl"
#include <lygia/color/space/hsv2rgb>

void mainImage(out vec4 fragColor, vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    // Chain multiple effects in one pass — no extra draw calls
    vec4 c = chromaticAberration(uv, iChannel0, 0.02, 8.0);
    c.rgb = hsv2rgb(rgb2hsv(c.rgb) + vec3(0.1, 0.2, 0.0));
    c = vec4(vignette(uv, c.rgb, 0.8), c.a);

    fragColor = c;
}
```

This is more performant than chaining separate nodes (one pass vs three) and gives full control.

## Built-In Effects

Ship a starter set as VFS files. These use lygia for utility functions where applicable:

**Generators**: `fbm-noise`, `voronoi-cells`, `sdf-scene`, `plasma`, `spiral`

**Effects**: `chromatic-aberration`, `bloom`, `pixelate`, `edge-detect`, `sharpen`, `vignette`, `film-grain`, `glitch`, `normal-from-height`, `dither`

**Combiners**: `blend-modes`, `dissolve`, `depth-composite`

**Coordinate**: `barrel-distort`, `kaleidoscope`, `tile`, `polar`, `wave-distort`

**Color**: `hsv-adjust`, `levels`, `color-ramp`, `posterize`, `tonemap`

**Materials**: `pbr-standard`, `pbr-clearcoat`, `toon`, `matcap`, `glass`, `unlit`

## Effect File Storage

Effects are VFS files, not bundled source code:

```
VFS: user://effects/
  generators/
    fbm-noise.glsl
    voronoi-cells.glsl
  effects/
    chromatic-aberration.glsl
    bloom.glsl
  combiners/
    blend-modes.glsl
  coordinate/
    barrel-distort.glsl
  color/
    hsv-adjust.glsl
  materials/
    pbr-standard.glsl
    toon.glsl
    matcap.glsl
```

Built-in effects ship as default VFS content. Users add their own effects to the same directory structure.

## Hydra Integration

Since Patchies controls the vendored Hydra fork, `setFunction` preprocesses `#include` directives automatically. Hydra-specific reusable functions are stored as VFS files with the `@hydra` directive.

**Hydra snippets are separate from GLSL effect files.** Hydra functions use Hydra's conventions (`_st`, `_c0`, body-only format) which don't map cleanly to standalone GLSL functions. Don't try to bridge the two — they're different formats for different contexts.

### `@hydra` Directive

VFS files with `@hydra` auto-register as Hydra transforms on patch load. The file contains the function body (not a full function declaration), using Hydra's implicit variables.

```glsl
// user://hydra-effects/crystal-noise.glsl
// @hydra crystalNoise
// @type src
// @param float scale 4.0
// @param float speed 0.1

#include <lygia/generative/snoise>
return vec4(vec3(snoise(vec3(_st * scale, time * speed))), 1.0);
```

This generates:

```javascript
setFunction({
  name: 'crystalNoise',
  type: 'src',
  inputs: [
    {type: 'float', name: 'scale', default: 4.0},
    {type: 'float', name: 'speed', default: 0.1},
  ],
  glsl: `
    #include <lygia/generative/snoise>

    return vec4(vec3(snoise(vec3(_st * scale, time * speed))), 1.0);
  `,
})
```

Then usable in any Hydra node:

```javascript
crystalNoise(8.0, 0.2).rotate(0.5).kaleid(4).out()
```

### Hydra Types

| `@type` value  | Hydra type     | Implicit args        | Description                      |
| -------------- | -------------- | -------------------- | -------------------------------- |
| `src`          | `src`          | `vec2 _st`           | Generates color from coordinates |
| `coord`        | `coord`        | `vec2 _st`           | Transforms coordinates           |
| `color`        | `color`        | `vec4 _c0`           | Transforms color                 |
| `combine`      | `combine`      | `vec4 _c0, vec4 _c1` | Blends two colors                |
| `combineCoord` | `combineCoord` | `vec2 _st, vec4 _c0` | Coordinate distortion with color |

### Drag-Drop onto Hydra Node

Dropping a `@hydra`-annotated `.glsl` file onto a Hydra node calls `setFunction` with the extracted metadata. The function becomes immediately chainable.

### Hydra Snippet Storage

```
VFS: user://hydra-effects/
  crystal-noise.glsl
  chromab.glsl
  pixelsort.glsl
  ...
```

These are scanned on patch load. Each file with `@hydra` is auto-registered. Changes to files trigger re-registration.

## AI Integration

Add effect names and descriptions to `object-descriptions-types.ts` so the AI can suggest effects. When a user asks "add chromatic aberration", the AI writes the `#include` and function call in their existing node, or creates a new GLSL node with the scaffold.

## Implementation Priority

1. **Function signature parser** — infer type/inlets/uniforms from GLSL function signature
2. **Drag-drop: onto node** — insert `#include` directive
3. **Drag-drop: onto canvas** — create GLSL node with inferred scaffold
4. **Effect-specific metadata parser** — read `@type`, `@slot`, `@depend` (`@title` and `@param` already implemented via spec 125)
5. **Built-in effects** — ship the starter set as VFS files
6. **Built-in materials** — `@slot` metadata, standard slot names, PBR/toon/matcap
7. **Material preview preset** — Three.js preset that auto-maps slots to MeshStandardMaterial
8. **`@hydra` directive + auto-registration** — VFS hydra-effects scanned on load, `setFunction` called automatically

## Dependencies

- Requires spec 118 (`#include` preprocessor) for importing GLSL code
- Reuses `@title` and `@param` directive parser from spec 125 (GLSL Metadata Directives)
- Drag-drop extends existing `CanvasDragDropManager.ts`
- `@hydra` directive requires `setFunction` implementation in vendored Hydra fork
- Materials benefit from spec 111 (MRT) for multi-channel output and spec 117 (resource pool) for environment maps
