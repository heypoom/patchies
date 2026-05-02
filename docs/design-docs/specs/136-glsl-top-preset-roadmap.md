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
  rendering, custom geometry, frame history, buffers, or multiple render targets.
- Keep names object-like and discoverable in user-facing operator preset packs.
- Organize presets by what users are trying to do, not by whether the underlying
  implementation happens to be `glsl` or `regl`.

## Non-Goals

- Do not add I/O, hardware, native SDK, or proprietary integration presets here.
- Do not add a new TOP compatibility layer.
- Do not attempt exact TouchDesigner parity.
- Do not implement these presets in this spec.

## Existing Context

The current GLSL Operators pack already covers:

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

The next presets should expand mask-building, keying, color utilities,
compositing, and practical image-processing tools before moving into heavier
render-pipeline work.

## Preset Pack Strategy

Do not keep growing one huge **GLSL Operators** pack. The implementation detail
is less important than the creative task the user is doing, and future packs may
mix `glsl`, `regl`, `swgl`, or `three` presets when that gives the best result.

Recommended user-facing packs:

| Pack                     | Purpose                                      | Likely Presets                                                                      |
| ------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Texture Generators**   | Start a visual chain from procedural content | `Constant`, `Linear Ramp`, `Radial Ramp`, `Circular Ramp`, `Noise`                  |
| **Texture Composite**    | Combine multiple textures                    | `Mix`, `Multiply`, `Add`, `Subtract`, `Difference`, `Composite`, `Over`, `Feedback` |
| **Texture Color**        | Color correction and color-space utilities   | `Level`, `HSV Adjust`, `Monochrome`, `Channel Mix`, `Remap`                         |
| **Texture Masks & Keys** | Build and apply alpha/matte textures         | `Threshold`, `Chroma Key`, `RGB Key`, `Luma Key`, `Matte`                           |
| **Texture Transform**    | Move, fit, repeat, and distort textures      | `Transform`, `Crop`, `Fit`, `Flip`, `Mirror`, `Tile`, `Lens Distort`                |
| **Texture Filters**      | Image-processing effects                     | `Blur`, `Edge`, `Emboss`, `Slope`, `Normal Map`, `Tone Map`                         |

The existing **GLSL Operators** pack can remain during the first migration, but
new work should move toward these task-based packs. Presets should still be
implemented as one file per preset under the appropriate built-in preset module;
pack membership is just how they are exposed to users.

## Best Next GLSL Presets

These are high-value, single-node, and realistic inside the current `glsl`
object.

| Preset         | Inputs                     | Parameters                                  | Notes                                                       |
| -------------- | -------------------------- | ------------------------------------------- | ----------------------------------------------------------- |
| `Add`          | `a`, `b`                   | opacity, clamp                              | Basic additive composite. Useful for feedback and masks.    |
| `Subtract`     | `a`, `b`                   | opacity, clamp                              | Difference-style utility for matte and signal workflows.    |
| `Difference`   | `a`, `b`                   | opacity, monochrome                         | Absolute difference between two images.                     |
| `Composite`    | `background`, `foreground` | mode, opacity                               | A grouped alpha composite preset with common blend modes.   |
| `Over`         | `background`, `foreground` | opacity                                     | Standard source-over alpha composite.                       |
| `Under`        | `foreground`, `background` | opacity                                     | Source-under variant for explicit layer ordering.           |
| `Channel Mix`  | `source`                   | RGB matrix rows, opacity                    | Matrix-style channel remapping and color transformation.    |
| `HSV Adjust`   | `source`                   | hue, saturation, value, mix                 | Practical color grading utility.                            |
| `RGB to HSV`   | `source`                   | none or normalize                           | Utility conversion preset for shader workflows.             |
| `HSV to RGB`   | `source`                   | none or normalize                           | Companion conversion preset.                                |
| `Chroma Key`   | `source`                   | key color, tolerance, softness, spill       | Webcam/video keying, useful with camera and video nodes.    |
| `RGB Key`      | `source`                   | min/max color, softness, invert             | Color-range matte generator.                                |
| `Luma Key`     | `source`                   | threshold, softness, invert                 | Luminance matte generator.                                  |
| `Matte`        | `source`, `matte`          | premultiply, invert, opacity                | Apply an alpha matte texture to a source.                   |
| `Threshold`    | `source`                   | threshold, softness, channel, invert        | General mask generation.                                    |
| `Monochrome`   | `source`                   | channel, weights, tint                      | Grayscale or tinted monochrome conversion.                  |
| `Limit`        | `source`                   | min, max, mode                              | Clamp, wrap, or normalize color ranges.                     |
| `Remap`        | `source`                   | in min/max, out min/max, clamp              | Range remapping for color or data textures.                 |
| `Lookup`       | `source`, `lookup`         | amount, channel                             | 1D LUT-like lookup using a texture input.                   |
| `Fit`          | `source`                   | mode, background color                      | Fit/contain/cover an input while preserving aspect ratio.   |
| `Flip`         | `source`                   | horizontal, vertical                        | Simple image orientation utility.                           |
| `Mirror`       | `source`                   | axis, center, blend                         | Reflect texture coordinates around an axis.                 |
| `Tile`         | `source`                   | repeat X/Y, offset, mirror                  | Dedicated tiling preset, easier than full `Transform`.      |
| `Circle`       | none                       | center, radius, feather, fill color, alpha  | Shape/matte generator.                                      |
| `Rectangle`    | none                       | center, size, rotation, feather, fill color | Shape/matte generator.                                      |
| `Cross`        | none                       | center, size, thickness, feather, color     | Utility shape generator for masks and calibration visuals.  |
| `Emboss`       | `source`                   | strength, direction, bias                   | Classic image filter from neighboring samples.              |
| `Slope`        | `source`                   | strength, channel, mode                     | Gradient/slope visualization, useful before normal maps.    |
| `Normal Map`   | `source`                   | strength, channel, invert Y                 | Generate approximate normals from height/luma.              |
| `Lens Distort` | `source`                   | amount, center, chromatic aberration, scale | Barrel/pincushion and optional RGB channel offset.          |
| `Tone Map`     | `source`                   | exposure, gamma, operator, white point      | Useful with float/HDR textures and bright feedback patches. |

## GLSL Possible

These can be built with a single fullscreen fragment shader, but they are either
more niche, overlapping, or awkward to expose through compact settings.

| Preset          | Inputs            | Why It Is Possible                           | Caveat                                                      |
| --------------- | ----------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `Anti Alias`    | `source` or none  | Smoothstep-based cleanup for generated masks | Ambiguous as a post-process image operator.                 |
| `Convolve`      | `source`          | Fixed 3x3 or 5x5 convolution kernels         | Arbitrary kernel editing is clunky in the current UI.       |
| `Function`      | none              | Procedural math/pattern generation           | Too broad unless scoped to a small useful set of functions. |
| `Layer Mix`     | multiple textures | Blend several layers by opacity/mode         | Overlaps `Composite`, `Over`, `Under`, and `Switcher`.      |
| `Luma Blur`     | `source`          | Blur amount gated by luminance               | Better after base blur/compositing presets feel mature.     |
| `Luma Level`    | `source`          | Level controls applied to luminance only     | Useful, but a narrow variant of `Level`.                    |
| `Math`          | `a`, `b`          | Per-channel arithmetic is easy in GLSL       | Better decomposed into explicit `Add`, `Subtract`, etc.     |
| `Pack`          | multiple textures | Pack channels from several inputs into RGBA  | Needs careful inlet naming and channel-selector UX.         |
| `PreFilter Map` | `source`          | Can approximate prefilter-style blur/mips    | True mip/prefilter behavior is limited in a single pass.    |
| `Resolution`    | `source` or none  | Can output pixelated/downsampled looks       | Actual output sizing already belongs to GLSL directives.    |
| `Select`        | multiple textures | Numeric selector over sampler inputs         | Mostly covered by `Switcher`.                               |
| `Switch`        | multiple textures | Same as `Select` with a different name       | Existing `Switcher` already handles the common case.        |

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

## Better With REGL

These are possible in Patchies, but `regl` is the better target because it gives
full draw-command control, custom geometry, multiple passes, render targets,
buffers, and explicit texture/resource management.

| Preset            | Why `regl` Fits Better                                          | Possible Patchies Shape                                      |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| `Bloom`           | Real bloom wants downsample, blur, and upsample passes.         | A `regl` preset with internal framebuffers and controls.     |
| `Cache`           | Requires frame history beyond one previous feedback input.      | Ring buffer of textures managed inside a `regl` preset.      |
| `Cache Select`    | Requires indexed lookup into cached frame history.              | Companion to `Cache`, or a combined cache/select preset.     |
| `Time Machine`    | Temporal lookup and interpolation over many frames.             | `regl` history buffer with index/speed controls.             |
| `Optical Flow`    | Needs multi-pass analysis and previous-frame state.             | Ping-pong framebuffers plus vector output or visualization.  |
| `Blob Track`      | Needs analysis/state and possibly readback/CPU logic.           | `regl` preprocessing plus future analysis/readback support.  |
| `Layout`          | Better as geometry/layout over multiple textured quads.         | Draw multiple input textures into positioned rectangles.     |
| `Layer`           | Layer stack compositing maps naturally to draw order.           | `regl` preset that draws N textured quads with blend state.  |
| `Cube Map`        | Needs non-2D texture targets and specialized sampling.          | Future advanced `regl`/WebGL texture preset.                 |
| `Texture 3D`      | Needs 3D texture allocation/sampling control.                   | Future `regl` preset if WebGL2 texture support is exposed.   |
| `Depth`           | Depth buffers are render-pipeline state, not GLSL output.       | `regl` render preset with depth attachment or depth texture. |
| `SSAO`            | Screen-space AO is a multipass depth/normal post-process.       | REGL pipeline using depth/normal inputs or MRT outputs.      |
| `Render`          | Scene rendering requires geometry, cameras, and draw calls.     | Already closer to `three`, `regl`, or `swgl` nodes.          |
| `Render Pass`     | Render-pass selection is a pipeline/MRT concern.                | `regl`/MRT preset that emits multiple attachments.           |
| `Render Select`   | Selecting render outputs requires pipeline-level routing.       | Could be a `regl` preset or graph-level convenience.         |
| `Render Simple`   | Still a scene-rendering concept, not a fullscreen shader.       | Prefer `regl` or `three` presets.                            |
| `Projection`      | Projection mapping wants custom mesh/UV geometry.               | Better handled by `projmap` or a `regl` mesh preset.         |
| `GLSL Multi`      | Multi-output workflows are possible in GLSL but richer in REGL. | `regl` MRT preset with explicit output attachments.          |
| `Point Transform` | Point/geometry transforms need buffers and vertex shaders.      | `regl` point buffer transform/render preset.                 |
| `POP to`          | Geometry/data pipeline conversion needs structured buffers.     | Future geometry bridge, not a plain GLSL preset.             |

## Implementation Groups

Implement the **Best Next GLSL Presets** section in five small groups. Each group
should land with registry updates, pack membership, documentation, and focused
verification before starting the next one.

### Group 1 — Compositing

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
