# 100. Paper Shaders Preset Pack

## Goal

Add an initial Paper Shaders preset pack that gives Patchies users a small set of polished GLSL texture generators adapted from `@paper-design/shaders`.

## Scope

The first pack includes four standalone shaders that can run inside the existing `glsl` object without adding a new renderer path:

- Paper Mesh Gradient
- Paper Dot Grid
- Paper Waves
- Paper Spiral

The pack is intentionally limited to shaders that do not require uploaded images, preprocessing, or Paper's noise texture asset. Image filters and shaders that depend on Paper's full vertex shader/runtime are out of scope for this first pass.

## Design

Each shader is added as a normal built-in GLSL preset under `ui/src/lib/presets/builtin/glsl/`. The ports keep the visual structure of the Paper shader, but adapt it to Patchies' Shadertoy-style `mainImage(out vec4 fragColor, in vec2 fragCoord)` wrapper.

Paper's custom varyings are approximated in fragment code:

- `v_objectUV` becomes a centered square UV derived from `fragCoord / iResolution.xy`
- `v_patternUV` becomes a centered aspect-corrected UV derived from `fragCoord / iResolution.xy`
- `u_time` becomes `iTime`

Each preset declares Patchies `// @param` metadata for its editable controls and hides the internal Paper-style sizing controls by omitting them from the port. Color uniforms use `vec3` color picker params instead of Paper's `vec4` colors, with opacity simplified to fully opaque output for the first pass.

## Preset Pack

Register a new built-in preset pack:

- id: `paper-shaders`
- name: `Paper Shaders`
- required object: `glsl`
- presets: the four Paper GLSL presets above

The pack appears alongside existing visual preset packs and follows the existing built-in preset pack registry.

## Attribution

The shader ports include source attribution comments and preserve the package license/notice context in code comments. The source package is Apache-2.0 with a `NOTICE` file.

## Verification

Add a focused preset-pack test that verifies the Paper Shaders pack is registered, requires `glsl`, lists exactly the four initial presets, and that each preset is a GLSL preset with `mainImage` code.

Run the focused preset pack tests and type checking after implementation.
