# 136. GLSL TOP Preset Roadmap

## Problem

Spec 135 added the first TouchDesigner-inspired GLSL Operators preset set. The
TouchDesigner TOP catalog is much larger, and many operators are either useful
as single-node GLSL presets or interesting as future `regl` presets.

This spec captures the next useful preset candidates from that brainstorm. It
intentionally excludes I/O, hardware, native plugin, application integration, and
viewer/operator-shell TOPs. The goal is to identify effects, generators, utility
operators, and render-pipeline ideas that fit Patchies' visual node model.

## Goals

- Identify high-value TouchDesigner-inspired presets that can be implemented as
  single `glsl` nodes.
- Separate straightforward GLSL presets from more advanced candidates.
- Call out presets that are better suited to `regl` because they need multipass
  rendering, custom geometry, frame history, buffers, or lower-level resource
  control.
- Keep names object-like and discoverable in user-facing operator preset packs.
- Organize presets by what users are trying to do, not by whether the underlying
  implementation happens to be `glsl` or `regl`.

## Non-Goals

- Do not add I/O, hardware, native SDK, or proprietary integration presets here.
- Do not add a new TOP compatibility layer.
- Do not attempt exact TouchDesigner parity.
- Do not require exact one-to-one TouchDesigner behavior for presets marked
  implemented here.

## Status Legend

- **Added**: implemented as a built-in preset and assigned to a user-facing
  preset pack.
- **Skip**: intentionally not planned because the behavior is redundant or
  misleading in the current system.
- **Defer**: potentially useful, but needs a clearer product shape before
  implementation.
- **REGL**: better suited to a future `regl` preset or render-pipeline feature.

## Existing Context

The built-in GLSL preset set already covers:

- `Constant`
- `Mix`
- `Switcher`
- `Linear Ramp`
- `Radial Ramp`
- `Circular Ramp`
- `Level`
- `Transform`
- `Multiply`
- `Blur`
- `Crop`
- `Reorder`
- `Displace`
- `Edge`
- `Noise`
- `Noise Displace`
- `Feedback`
- `Chromatic Aberration`
- all presets marked **Added** in the tables below

The next presets should expand mask-building, keying, color utilities,
compositing, and practical image-processing tools before moving into heavier
render-pipeline work.

## Preset Pack Strategy

Do not keep growing one huge **GLSL Operators** pack. The implementation detail
is less important than the creative task the user is doing, and future packs may
mix `glsl`, `regl`, `swgl`, or `three` presets when that gives the best result.

Recommended user-facing packs:

| Pack                     | Purpose                                      | Current Presets                                                                                                                                         | Status |
| ------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Texture Generators**   | Start a visual chain from procedural content | `Constant`, `Linear Ramp`, `Radial Ramp`, `Circular Ramp`, `Noise`, `Circle`, `Rectangle`, `Cross`                                                      | Added  |
| **Texture Composite**    | Combine multiple textures                    | `Mix`, `Multiply`, `Add`, `Subtract`, `Difference`, `Math`, `Composite`, `Over`, `Under`, `Layout`, `Layer`, `Switcher`                                 | Added  |
| **Texture Time**         | Feedback and frame-history utilities         | `Feedback`, `Cache`, `Time Scrub`, `Time Machine`                                                                                                       | Added  |
| **Texture Color**        | Color correction and color-space utilities   | `Level`, `Luma Level`, `HSV Adjust`, `Monochrome`, `Channel Mix`, `Pack`, `Limit`, `Remap`, `Lookup`, `RGB to HSV`, `HSV to RGB`, `Tone Map`, `Reorder` | Added  |
| **Texture Masks & Keys** | Build and apply alpha/matte textures         | `Threshold`, `Chroma Key`, `RGB Key`, `Luma Key`, `Matte`                                                                                               | Added  |
| **Texture Transform**    | Move, fit, repeat, and distort textures      | `Transform`, `Crop`, `Fit`, `Flip`, `Mirror`, `Tile`, `Lens Distort`, `Displace`, `Noise Displace`                                                      | Added  |
| **Texture Filters**      | Image-processing effects                     | `Blur`, `Luma Blur`, `Chromatic Aberration`, `Convolve`, `Edge`, `Anti Alias`, `Emboss`, `Slope`, `Normal Map`, `Bloom`, `Motion Flow`                  | Added  |

The existing **GLSL Operators** pack can remain during the first migration, but
new work should move toward these task-based packs. Presets should still be
implemented as one file per preset under the appropriate built-in preset module;
pack membership is just how they are exposed to users.

Keep **Texture Time** focused on temporal texture utilities. Future candidates
include a real `Cache Select` once shared cache resources exist, plus possible
trail/echo or stutter-style frame-history presets.

## Best Next GLSL Presets

These are high-value, single-node, and realistic inside the current `glsl`
object.

| Preset                 | Status | Pack                 | Inputs                     | Parameters                                  | Notes                                                       |
| ---------------------- | ------ | -------------------- | -------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `Add`                  | Added  | Texture Composite    | `a`, `b`                   | opacity, clamp                              | Basic additive composite. Useful for feedback and masks.    |
| `Subtract`             | Added  | Texture Composite    | `a`, `b`                   | opacity, clamp                              | Difference-style utility for matte and signal workflows.    |
| `Difference`           | Added  | Texture Composite    | `a`, `b`                   | opacity, monochrome                         | Absolute difference between two images.                     |
| `Composite`            | Added  | Texture Composite    | `background`, `foreground` | mode, opacity                               | A grouped alpha composite preset with common blend modes.   |
| `Over`                 | Added  | Texture Composite    | `background`, `foreground` | opacity                                     | Standard source-over alpha composite.                       |
| `Under`                | Added  | Texture Composite    | `foreground`, `background` | opacity                                     | Source-under variant for explicit layer ordering.           |
| `Channel Mix`          | Added  | Texture Color        | `source`                   | RGB matrix rows, opacity                    | Matrix-style channel remapping and color transformation.    |
| `HSV Adjust`           | Added  | Texture Color        | `source`                   | hue, saturation, value, mix                 | Practical color grading utility.                            |
| `RGB to HSV`           | Added  | Texture Color        | `source`                   | none or normalize                           | Utility conversion preset for shader workflows.             |
| `HSV to RGB`           | Added  | Texture Color        | `source`                   | none or normalize                           | Companion conversion preset.                                |
| `Chroma Key`           | Added  | Texture Masks & Keys | `source`                   | key color, tolerance, softness, spill       | Webcam/video keying, useful with camera and video nodes.    |
| `RGB Key`              | Added  | Texture Masks & Keys | `source`                   | min/max color, softness, invert             | Color-range matte generator.                                |
| `Luma Key`             | Added  | Texture Masks & Keys | `source`                   | threshold, softness, invert                 | Luminance matte generator.                                  |
| `Matte`                | Added  | Texture Masks & Keys | `source`, `matte`          | premultiply, invert, opacity                | Apply an alpha matte texture to a source.                   |
| `Threshold`            | Added  | Texture Masks & Keys | `source`                   | threshold, softness, channel, invert        | General mask generation.                                    |
| `Monochrome`           | Added  | Texture Color        | `source`                   | channel, weights, tint                      | Grayscale or tinted monochrome conversion.                  |
| `Limit`                | Added  | Texture Color        | `source`                   | min, max, mode                              | Clamp, wrap, or normalize color ranges.                     |
| `Remap`                | Added  | Texture Color        | `source`                   | in min/max, out min/max, clamp              | Range remapping for color or data textures.                 |
| `Lookup`               | Added  | Texture Color        | `source`, `lookup`         | amount, channel                             | 1D LUT-like lookup using a texture input.                   |
| `Fit`                  | Added  | Texture Transform    | `source`                   | mode, background color                      | Fit/contain/cover an input while preserving aspect ratio.   |
| `Flip`                 | Added  | Texture Transform    | `source`                   | horizontal, vertical                        | Simple image orientation utility.                           |
| `Mirror`               | Added  | Texture Transform    | `source`                   | axis, center, blend                         | Reflect texture coordinates around an axis.                 |
| `Tile`                 | Added  | Texture Transform    | `source`                   | repeat X/Y, offset, mirror                  | Dedicated tiling preset, easier than full `Transform`.      |
| `Circle`               | Added  | Texture Generators   | none                       | center, radius, feather, fill color, alpha  | Shape/matte generator.                                      |
| `Rectangle`            | Added  | Texture Generators   | none                       | center, size, rotation, feather, fill color | Shape/matte generator.                                      |
| `Cross`                | Added  | Texture Generators   | none                       | center, size, thickness, feather, color     | Utility shape generator for masks and calibration visuals.  |
| `Emboss`               | Added  | Texture Filters      | `source`                   | strength, direction, bias                   | Classic image filter from neighboring samples.              |
| `Slope`                | Added  | Texture Filters      | `source`                   | strength, channel, mode                     | Gradient/slope visualization, useful before normal maps.    |
| `Normal Map`           | Added  | Texture Filters      | `source`                   | strength, channel, invert Y                 | Generate approximate normals from height/luma.              |
| `Lens Distort`         | Added  | Texture Transform    | `source`                   | amount, center, chromatic aberration, scale | Barrel/pincushion and optional RGB channel offset.          |
| `Chromatic Aberration` | Added  | Texture Filters      | `source`                   | amount, direction, center, falloff, mix     | Dedicated RGB channel separation without lens warping.      |
| `Tone Map`             | Added  | Texture Color        | `source`                   | exposure, gamma, operator, white point      | Useful with float/HDR textures and bright feedback patches. |

## GLSL Possible

These can be built with a single fullscreen fragment shader, but they are either
more niche, overlapping, or awkward to expose through compact settings.

| Preset          | Status | Pack / Next Home     | Inputs            | Why It Is Possible                           | Caveat / Note                                                |
| --------------- | ------ | -------------------- | ----------------- | -------------------------------------------- | ------------------------------------------------------------ |
| `Anti Alias`    | Added  | Texture Filters      | `source`          | Smoothstep-based cleanup for generated masks | Implemented as selected-channel alpha smoothing.             |
| `Convolve`      | Added  | Texture Filters      | `source`          | Fixed 3x3 convolution kernels                | Implemented with named kernels, not arbitrary matrix UI.     |
| `Function`      | Defer  | Texture Generators   | none              | Procedural math/pattern generation           | Too broad; split into specific generators before building.   |
| `Layer Mix`     | Defer  | Texture Composite    | multiple textures | Blend several layers by opacity/mode         | Overlaps `Composite`, `Over`, `Under`, and `Switcher`.       |
| `Luma Blur`     | Added  | Texture Filters      | `source`          | Blur amount gated by luminance               | Implemented as bright/dark-gated single-pass blur.           |
| `Luma Level`    | Added  | Texture Color        | `source`          | Level controls applied to luminance only     | Implemented as luma-ratio color adjustment.                  |
| `Math`          | Added  | Texture Composite    | `a`, `b`          | Per-channel arithmetic is easy in GLSL       | Implemented with selectable two-input operations.            |
| `Pack`          | Added  | Texture Color        | multiple textures | Pack channels from several inputs into RGBA  | Implemented with four named texture inputs.                  |
| `PreFilter Map` | Defer  | Texture Filters/REGL | `source`          | Can approximate prefilter-style blur/mips    | Avoid misleading GLSL-only version; true version wants REGL. |
| `Resolution`    | Skip   | n/a                  | `source` or none  | Can output pixelated/downsampled looks       | Skip because it cannot change actual render-target size.     |
| `Select`        | Skip   | n/a                  | multiple textures | Numeric selector over sampler inputs         | Existing `Switcher` covers the useful case.                  |
| `Switch`        | Skip   | n/a                  | multiple textures | Same as `Select` with a different name       | Existing `Switcher` already handles the common case.         |

### GLSL Possible Implementation Order

Work through these one-by-one so each preset gets a compact, tested UX before
moving on.

1. `Anti Alias`: add to **Texture Filters** as a mask/edge cleanup filter for
   generated shapes and threshold-style alpha textures. Keep the scope narrow:
   it smooths a selected channel into alpha and is not a replacement for true
   multisample anti-aliasing.
2. `Luma Blur`: add to **Texture Filters** as a single-pass blur whose blend
   amount is gated by source luminance. Let users target bright or dark regions
   so the preset can produce glow-like smearing without requiring a multi-pass
   bloom pipeline.
3. `Luma Level`: add to **Texture Color** as a luminance-only level utility.
   Adjust the source luma curve and reapply it to RGB as a ratio so hue is
   mostly preserved.
4. `Pack`: add to **Texture Color** as a channel-packing utility with four
   named texture inputs: `redSource`, `greenSource`, `blueSource`, and
   `alphaSource`. Each output channel gets a selector for Luma/R/G/B/A from its
   matching input.
5. `Convolve`: add to **Texture Filters** with named 3x3 kernels instead of
   editable matrix fields. Expose practical kernels such as sharpen, edge,
   outline, box blur, and gaussian-ish blur, plus strength and bias controls.
6. `Math`: add to **Texture Composite** as a compact two-input arithmetic
   utility. Keep explicit `Add`, `Subtract`, and `Difference` presets for common
   cases, but offer `Math` for selectable per-pixel operations.

Status: items 1-6 are **Added**. `Resolution`, `Select`, and `Switch` are
**Skip**. `Function`, `Layer Mix`, and `PreFilter Map` are **Defer** pending a
clearer product shape.

## Better With REGL

These are possible in Patchies, but `regl` is the better target because it gives
full draw-command control, custom geometry, multiple passes, render targets,
buffers, and explicit texture/resource management.

| Preset            | Status | Why `regl` Fits Better                                         | Possible Patchies Shape                                         |
| ----------------- | ------ | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `Bloom`           | Added  | Real bloom wants downsample, blur, and upsample passes.        | A `regl` preset with internal framebuffers and controls.        |
| `Cache`           | Added  | Requires frame history beyond one previous feedback input.     | Ring buffer of textures managed inside a `regl` preset.         |
| `Cache Select`    | Defer  | Requires indexed lookup into cached frame history.             | Needs shared cache resources or a combined cache/select design. |
| `Time Scrub`      | Added  | Manual temporal lookup needs frame history and interpolation.  | `regl` history buffer with an always-active position control.   |
| `Time Machine`    | Added  | Temporal lookup and interpolation over many frames.            | `regl` history buffer with index/speed controls.                |
| `Motion Flow`     | Added  | Needs previous-frame state and dual visualization/data output. | Creative flow approximation with visualization and vector data. |
| `Optical Flow`    | Defer  | Accurate optical flow needs multi-pass analysis and tuning.    | Future heavier preset if creative `Motion Flow` is not enough.  |
| `Blob Track`      | REGL   | Needs analysis/state and possibly readback/CPU logic.          | `regl` preprocessing plus future analysis/readback support.     |
| `Layout`          | Added  | Better as geometry/layout over multiple textured quads.        | Draw multiple input textures into positioned rectangles.        |
| `Layer`           | Added  | Layer stack compositing maps naturally to draw order.          | `regl` preset that draws N textured quads with blend state.     |
| `Cube Map`        | REGL   | Needs non-2D texture targets and specialized sampling.         | Future advanced `regl`/WebGL texture preset.                    |
| `Texture 3D`      | REGL   | Needs 3D texture allocation/sampling control.                  | Future `regl` preset if WebGL2 texture support is exposed.      |
| `Depth`           | REGL   | Depth buffers are render-pipeline state, not GLSL output.      | `regl` render preset with depth attachment or depth texture.    |
| `SSAO`            | REGL   | Screen-space AO is a multipass depth/normal post-process.      | REGL pipeline using depth/normal inputs or MRT outputs.         |
| `Render`          | REGL   | Scene rendering requires geometry, cameras, and draw calls.    | Already closer to `three`, `regl`, or `swgl` nodes.             |
| `Render Pass`     | REGL   | Render-pass selection is a pipeline/MRT workflow concern.      | Preset around existing MRT support and named attachments.       |
| `Render Select`   | REGL   | Selecting render outputs requires pipeline-level routing UX.   | Could be a `regl` preset or graph-level convenience.            |
| `Render Simple`   | REGL   | Still a scene-rendering concept, not a fullscreen shader.      | Prefer `regl` or `three` presets.                               |
| `Projection`      | REGL   | Projection mapping wants custom mesh/UV geometry.              | Better handled by `projmap` or a `regl` mesh preset.            |
| `GLSL Multi`      | Defer  | MRT already exists in visual nodes; preset shape is unclear.   | Maybe example presets/docs, not a new operator preset.          |
| `Point Transform` | REGL   | Point/geometry transforms need buffers and vertex shaders.     | `regl` point buffer transform/render preset.                    |
| `POP to`          | REGL   | Geometry/data pipeline conversion needs structured buffers.    | Future geometry bridge, not a plain GLSL preset.                |

### REGL Implementation Priority

Implement REGL-oriented presets in small phases so each one proves a specific
render-pipeline capability before the next phase depends on it.

1. `Bloom`: first REGL preset candidate. It is visually obvious and proves
   internal framebuffers, multipass rendering, blur/downsample passes, and final
   compositing.
2. `Cache`, `Time Scrub`, `Time Machine`: frame-history presets. Added after
   Bloom proved internal texture lifecycle and reload cleanup. `Cache Select`
   stays deferred until Patchies has shared cache resources or a clearer
   combined cache/select design.
3. `Layout`, `Layer`: multi-texture draw-order and quad-layout presets. Added
   to establish how REGL presets expose multiple video inputs and per-layer
   transform/blend controls.
4. `Render Pass`, `Render Select`, and any `GLSL Multi` follow-up: MRT already
   exists in `glsl` and `regl`, so the remaining work is UX, examples, naming,
   and graph routing conventions rather than core multi-output support. Spec
   this before implementation because it may affect preset metadata and texture
   attachment naming.
5. `Motion Flow` is the first added analysis-style preset, using a creative
   previous-frame approximation with visualization and vector outputs. Accurate
   `Optical Flow`, plus `Blob Track` and `SSAO`, remain later analysis work
   because they need multi-pass state, careful defaults, and more verification
   than the utility presets above.
6. `Cube Map`, `Texture 3D`, `Depth`, `Point Transform`, `POP to`: advanced
   resource/geometry features. Keep these parked until the REGL preset API has
   stable support for the required texture targets, buffers, and geometry data.

## Implementation Groups

Implement the **Best Next GLSL Presets** section in five small groups. Each group
should land with registry updates, pack membership, documentation, and focused
verification before starting the next one.

### Group 1 — Compositing

Status: **Added**.

Presets:

- `Add`
- `Subtract`
- `Difference`
- `Composite`
- `Over`
- `Under`

Pack target: **Texture Composite**.

This group gives users clearer texture-combination tools and avoids forcing all
blend workflows through `Mix` or `Multiply`.

### Group 2 — Keying And Masks

Status: **Added**.

Presets:

- `Threshold`
- `Chroma Key`
- `RGB Key`
- `Luma Key`
- `Matte`

Pack target: **Texture Masks & Keys**.

This group unlocks alpha/matte workflows for camera input, video clips,
procedural textures, and feedback chains.

### Group 3 — Color Utilities

Status: **Added**.

Presets:

- `HSV Adjust`
- `Monochrome`
- `Channel Mix`
- `Limit`
- `Remap`
- `Lookup`
- `RGB to HSV`
- `HSV to RGB`
- `Tone Map`

Pack target: **Texture Color**.

This group focuses on color correction, color-space conversion, and data-range
utilities. `Lookup` should define a clear 1D LUT texture contract before
implementation.

### Group 4 — Texture Transform Utilities

Status: **Added**.

Presets:

- `Fit`
- `Flip`
- `Mirror`
- `Tile`
- `Lens Distort`

Pack target: **Texture Transform**.

This group turns common transform modes into discoverable one-purpose presets
instead of requiring users to configure a mode-heavy `Transform` preset.

### Group 5 — Shape And Image Filters

Status: **Added**.

Presets:

- `Circle`
- `Rectangle`
- `Cross`
- `Emboss`
- `Slope`
- `Normal Map`

Pack targets: **Texture Generators** for shape generators and **Texture Filters**
for image filters.

This group adds mask-generation primitives and useful image-analysis/filtering
tools. Shape presets should output useful alpha by default.

## Implementation Notes

- Keep each GLSL preset as one file under `ui/src/lib/presets/builtin/glsl/`.
- Use `source`, `a`, `b`, `background`, `foreground`, and `matte` as sampler
  names; avoid reserved GLSL keywords such as `input`.
- Use `@primaryButton settings` for presets with controls.
- Use `@param` defaults that produce an obvious visible effect.
- Prefer separate named presets over mode-heavy mega-presets when only some
  settings apply to some modes.
- Use select directives for discrete modes such as blend mode, channel, fit
  mode, or clamp mode.
- Add descriptions for every preset so the object browser remains scannable.

## Testing

- Run the GLSL directive parser tests after adding or changing preset directives.
- Add a registry check that every name in the relevant texture preset packs
  exists in the built-in preset map.
- Smoke-test each generator without inputs.
- Smoke-test each processor with a connected `source` input.
- For key/matte presets, test both hard and soft edges.
- For REGL presets, verify resource cleanup and nonblank output after code
  reloads.
