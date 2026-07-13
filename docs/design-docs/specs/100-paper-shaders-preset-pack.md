# 100. Paper Shaders Preset Pack

## Goal

Add a Paper Shaders preset pack that gives Patchies users polished GLSL texture generators adapted from `@paper-design/shaders`.

## Scope

The pack includes standalone procedural shaders that can run inside the existing `glsl` object without adding a new renderer path:

- Paper Mesh Gradient
- Paper Dot Grid
- Paper Waves
- Paper Spiral
- Paper Static Mesh Gradient
- Paper Static Radial Gradient
- Paper Simplex Noise
- Paper Perlin Noise
- Paper Neuro Noise
- Paper Swirl
- Paper Color Panels
- Paper Dot Orbit
- Paper Metaballs
- Paper Voronoi
- Paper Warp
- Paper God Rays
- Paper Grain Gradient
- Paper Smoke Ring
- Paper Pulsing Border
- Paper Dithering
- Paper Liquid Metal
- Paper Gem Smoke
- Paper Texture

The pack is intentionally limited to shaders that do not require uploaded images or preprocessing. Shaders that use Paper's noise texture expose it as a `sampler2D noiseTexture` inlet so users can patch in any texture source. Image filters and shaders that depend on preprocessing are out of scope for this pass.

## Design

Each shader is added as a normal built-in GLSL preset under `ui/src/lib/presets/builtin/glsl/paper-shaders/`, with one file per preset and an `index.ts` barrel that exports the preset names and preset map. Shared GLSL snippets live in `shared.ts` so individual presets stay small enough to edit comfortably.

The ports keep the visual structure of the Paper shader, but adapt it to Patchies' Shadertoy-style `mainImage(out vec4 fragColor, in vec2 fragCoord)` wrapper.

Paper's custom varyings are approximated in fragment code:

- `v_objectUV` becomes a centered square UV derived from `fragCoord`
- `v_patternUV` becomes centered pixel space scaled by `.01`, matching Paper's pattern convention
- `u_time` becomes `iTime`

Each preset declares Patchies `// @param` metadata for its editable controls and hides the internal Paper-style sizing controls by omitting them from the port. Color uniforms use `vec3` color picker params instead of Paper's `vec4` colors, with opacity simplified to fully opaque output for this pack.

## Preset Pack

Register a new built-in preset pack:

- id: `paper-shaders`
- name: `Paper Shaders`
- required object: `glsl`
- presets: the Paper GLSL presets above

The pack appears alongside existing visual preset packs and follows the existing built-in preset pack registry.

## Attribution

The shader ports include source attribution comments and preserve the package license/notice context in code comments. The source package is Apache-2.0 with a `NOTICE` file.

## Verification

Add a focused preset-pack test that verifies the Paper Shaders pack is registered, requires `glsl`, lists exactly the supported presets, and that each preset is a GLSL preset with `mainImage` code.

Run the focused preset pack tests and type checking after implementation.
