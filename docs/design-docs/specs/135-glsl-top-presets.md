# 135. GLSL TOP Presets

## Problem

Patchies already has a GLSL object that can process video textures, expose shader
uniforms as settings, and participate in graph-level feedback loops. It also has
an existing **GLSL Operators** preset pack, but the current pack is closer to a
starter kit than a practical texture-operator library.

TouchDesigner's commonly used TOPs are a useful reference point for what people
expect from a live texture-processing environment: generators, color correction,
transforms, compositing, channel operations, displacement, blur, edge detection,
and feedback. Patchies can implement a useful subset of those as single-node GLSL
presets without adding new node types.

## Goals

- Add TouchDesigner-inspired GLSL presets to the existing **GLSL Operators** pack.
- Keep each preset as a single `glsl` node with editable shader code.
- Use user-facing preset names like `Level`, `Feedback`, and `Noise` instead of
  filename-style names like `level.gl`.
- Rename existing GLSL operator presets to the same title-case convention.
- Include both procedural `Noise` and an input-processing noise variation.
- Make feedback possible through a normal video inlet that users wire manually.
- Prefer approachable parameter sets over exhaustive TouchDesigner parity.

## Non-Goals

- Do not add a new TOP object family or a TouchDesigner compatibility layer.
- Do not create multi-node preset patches for feedback or simulations.
- Do not implement file, device, text, render, cache, or time-machine behavior.
- Do not change the render graph feedback system.
- Do not require users to understand TouchDesigner terminology.

## Approach

Add a focused batch of GLSL presets modeled after the Sweet 16 TOPs that map well
to fragment shaders. The presets should live under the existing **GLSL Operators**
pack, use `type: 'glsl'`, and populate `data.code` with complete shader code.

Each preset should include:

- `// @title` matching the user-facing preset name.
- `// @primaryButton settings` when the preset has useful controls.
- `// @param` directives for numeric ranges and color pickers.
- Named sampler uniforms that create understandable video inlets.
- Conservative defaults that produce a visible result immediately.

Use clean preset keys for the TOP-style presets. The built-in preset migration
currently uses the key as the display name, so keys should be `Level`,
`Feedback`, `Noise Displace`, etc. Filename-style GLSL operator keys should be
renamed to title-case names, except starter presets that end with `>`.

## Preset Set

### Sweet 16 Inspired Presets

| Preset           | Inputs                     | Parameters                                         | Notes                                                                   |
| ---------------- | -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `Ramp`           | none                       | mode, colors, angle, center, radius, offset        | Generator for linear, radial, and circular ramps.                       |
| `Level`          | `input`                    | black, white, gamma, brightness, contrast, opacity | Color correction and range remapping.                                   |
| `Transform`      | `input`                    | translate, scale, rotate, repeat mode              | UV-space transform for image placement and tiling.                      |
| `Overlay`        | `background`, `foreground` | opacity                                            | Alpha-composite foreground over background.                             |
| `Mix`            | `a`, `b`                   | mix                                                | Crossfade between two inputs.                                           |
| `Multiply`       | `a`, `b`                   | opacity                                            | Dedicated common composite mode.                                        |
| `Blur`           | `input`                    | radius, direction                                  | Single-pass practical blur; avoid expensive large kernels.              |
| `Crop`           | `input`                    | min, max, feather                                  | Window/crop the input and output transparent pixels outside the region. |
| `Reorder`        | `input`                    | channel selectors, invert alpha                    | Channel swizzle and alpha/luma utility.                                 |
| `Displace`       | `input`, `displacement`    | amount, center, channels                           | Warp one texture with another texture.                                  |
| `Edge`           | `input`                    | strength, threshold, mode                          | Sobel-style edge detection.                                             |
| `Noise`          | none                       | scale, speed, contrast, colors                     | Procedural animated noise generator.                                    |
| `Noise Displace` | `input`                    | scale, speed, amount, direction                    | Uses procedural noise to warp an input texture.                         |
| `Feedback`       | `input`, `feedback`        | feedback amount, decay, blend, transform           | Accumulate current input with manually wired previous-frame feedback.   |

### Out of Scope Sweet 16 Items

| TouchDesigner TOP | Reason                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| Movie File In     | Patchies file/media nodes own media loading.                               |
| Text              | Needs font/text layout behavior beyond a GLSL preset.                      |
| Render            | Three.js/REGL/SWGL nodes own scene rendering.                              |
| CHOP to           | Patchies audio/control-to-texture workflows should be designed separately. |
| Resolution        | Output sizing is handled by GLSL directives and render pipeline settings.  |
| Select            | Existing graph wiring and switcher-style presets cover selection.          |
| Cache             | Requires frame history beyond a single previous-frame feedback input.      |
| Time Machine      | Requires indexed temporal history, not just a single back-edge.            |

## Feedback Convention

Feedback presets remain single GLSL nodes. They should expose a normal sampler
inlet named `feedback`:

```glsl
uniform sampler2D input;
uniform sampler2D feedback;
```

Users create feedback by wiring the GLSL node's output back into its own
`feedback` inlet. The graph-level feedback system detects that back-edge and
routes the previous frame's texture through the inlet.

The `Feedback` preset should also work when only `input` is connected. The first
frame and any missing feedback texture should produce a stable, visible output
instead of black surprise where practical.

## Noise Presets

### Noise

`Noise` is a procedural generator. It should be useful as a standalone visual
source and as a displacement/control texture for downstream nodes.

Recommended controls:

- `scale`: spatial frequency.
- `speed`: animation rate.
- `contrast`: remap the noise range.
- `colorA` and `colorB`: colorize grayscale noise.

Implementation can use either compact local noise functions or Lygia includes.
Prefer Lygia if it keeps the shader readable and the include path is already
supported by the GLSL object.

### Noise Displace

`Noise Displace` processes an input texture. It samples procedural noise, turns
that noise into a UV offset, and samples `input` at the warped coordinates.

Recommended controls:

- `scale`: noise frequency.
- `speed`: animation rate.
- `amount`: displacement strength.
- `direction`: blend between horizontal, vertical, and radial-ish offsets.

This should be separate from `Displace`, which uses a second texture input as the
displacement map.

## Naming

The user-facing names should be object-like and title-case:

- `Level`
- `Transform`
- `Feedback`
- `Noise Displace`

Avoid exposing `.gl` suffixes in places where users browse presets. For the
current built-in preset map, this means the new preset keys themselves should be
clean title-case names.

Rename existing GLSL operator presets to title-case keys:

| Current key | New key |
| ----------- | ------- |
| `mix.gl` | `Mix` |
| `overlay.gl` | `Overlay` |
| `solid.gl` | `Solid` |
| `switcher.gl` | `Switcher` |

Leave starter presets that end with `>` unchanged:

- `glsl>`
- `regl>`
- `swgl>`
- `three>`

Existing non-operator demo presets such as `fft-freq.gl`, `fft-waveform.gl`,
`position-field.gl`, and `torus-position-field.gl` can keep their current names
unless they are moved into a separate cleanup pass.

## Implementation Plan

1. Add GLSL shader constants for the new presets.
2. Register the presets in `ui/src/lib/presets/builtin/glsl.presets.ts` using
   clean title-case keys.
3. Update the **GLSL Operators** pack in `ui/src/lib/extensions/preset-packs.ts`.
4. Rename existing GLSL operator keys: `mix.gl` to `Mix`, `overlay.gl` to
   `Overlay`, `solid.gl` to `Solid`, and `switcher.gl` to `Switcher`.
5. Leave `glsl>`, `regl>`, `swgl>`, and `three>` unchanged.
6. Use clean preset keys and `@title` directives for TOP-style names.
7. Update `ui/static/content/objects/glsl.md` to mention the expanded TOP-style
   preset set.

## Testing

- Run `bun run check` from `ui/`.
- Add or update unit tests only if preset registration has existing coverage.
- Manually inspect the preset list to confirm names appear in **GLSL Operators**.
- Smoke-test at least:
  - `Ramp` renders without inputs.
  - `Level` passes and modifies an input.
  - `Noise` renders without inputs.
  - `Noise Displace` modifies an input.
  - `Feedback` can be wired output-to-`feedback` and produces a 1-frame-delayed
    accumulation.

## Follow-Ups

- Add a `Constant` preset if we want closer parity with TouchDesigner's Constant
  TOP.
- Add simulation-style feedback presets such as `Reaction Diffusion` and
  `Game of Life` after the basic `Feedback` preset lands.
- Consider grouping GLSL presets inside the pack by generator, processor,
  composite, and feedback once the list grows.
