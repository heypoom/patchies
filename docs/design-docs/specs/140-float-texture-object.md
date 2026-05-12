# 140. Float Texture Object

## Goal

Add a playful MVP object, `float.tex`, that turns `Float32Array` data into a live video texture for downstream visual nodes.

The first target workflow is:

```text
[tap~ / table / js producing Float32Array] -> [float.tex] -> [glsl] -> [bg.out]
```

## MVP Behavior

- `float.tex` has one message inlet and one video outlet.
- The inlet accepts:
  - `Float32Array` as a single red channel row.
  - `Float32Array[]` as ordered channel data.
  - `{ type: 'wrapped', channels: Float32Array | Float32Array[], width, format?, textureFormat? }` as wrapped channel packing.
  - `{ type: 'wrapped', channels: SharedArrayBuffer | SharedArrayBuffer[], width, version, format?, textureFormat? }` as shared wrapped channel packing.
  - `{ type: 'square', channels: Float32Array | Float32Array[], format?, textureFormat? }` as square channel packing.
  - `{ type: 'square', channels: SharedArrayBuffer | SharedArrayBuffer[], version, format?, textureFormat? }` as shared square channel packing.
  - `{ data: Float32Array, width, height, type: 'r' | 'rg' | 'rgb' | 'rgba', textureFormat? }` as already-interleaved pixel data.
  - `{ buffer: SharedArrayBuffer, width, height, type: 'r' | 'rg' | 'rgb' | 'rgba', version, textureFormat? }` as shared already-interleaved pixel data.
- Shared wrapped and square channel messages require `version`; repeated messages for the same shared buffers and version should be skipped.
- `textureFormat` may be `'rgba32f'`, `'rgba16f'`, or `'rgba8'`; default is `'rgba32f'`.
- The MVP packs samples into an `RGBA32F` texture.
- Missing channels are filled with `(0, 0, 0, 1)`.
- The output texture uses nearest filtering and clamp wrapping.
- Channel names are ignored; order controls packing.
- Same-size updates should reuse the existing GPU texture and update its pixels; resizing reallocates the texture and framebuffer.
- The packer may reuse an internal output buffer, but upload transfer should use an owned copy so user-provided input arrays and the reusable pack buffer are not detached.
- Upload transfer buffers should be returned from the render worker after the WebGL upload and reused by `GLSystem` for later same-size uploads.
- Multiple incoming messages in the same animation frame should coalesce into one upload; only the latest packed texture is flushed to the render worker.
- Packing validation errors should be shown on the `float.tex` node and logged through the node-scoped console. A later successful upload clears the visible error.
- The render-worker upload path should reject malformed float texture messages and mismatched packed pixel lengths before touching WebGL.

## Session Summary

Implemented the MVP `float.tex` object and iterated it from a basic `Float32Array[]` packer into a practical data-texture bridge:

- Added `float.tex` as a message-in, video-out object that uploads packed float data as an `RGBA32F` texture.
- Added TouchDesigner CHOP to TOP attribution in the public docs.
- Added channel-count inference: `Float32Array`/`[r]` → `r`, `[r, g]` → `rg`, `[r, g, b]` → `rgb`, and four or more channels → `rgba`.
- Fixed the initial black-texture bug by restoring raw WebGL texture, active texture, and framebuffer state after manual uploads.
- Changed same-size GPU updates to use `texSubImage2D`; resizing now reallocates the destination texture and framebuffer.
- Added packer buffer reuse for planar inputs, plus a pooled upload-buffer path in `GLSystem`.
- Added render-worker buffer return after upload so transfer buffers can be reused instead of allocated every send.
- Fixed resize uploads by ensuring the previous destination framebuffer is destroyed only once before replacement.
- Added frame-level upload coalescing in `FloatTextureNode`; multiple messages in the same animation frame upload only the latest texture.
- Added explicit already-interleaved RGBA input: `{ type: 'rgba', data: Float32Array, width, height }`, which skips repacking.
- Added SharedArrayBuffer RGBA input: `{ type: 'rgba', buffer: SharedArrayBuffer, width, height, version }`, with a per-buffer version dirty check.
- Updated the manual object schema, AI prompt, object docs, and design spec to cover planar channels, interleaved RGBA, and shared RGBA buffers.
- Added focused tests for packing, same-size/resize texture updates, upload-buffer pooling, frame upload coalescing, and shared-buffer version tracking.

## Initial Packing Contract

The MVP supports the TouchDesigner-inspired channel grouping modes:

| Format | Channels per row | Output rows                 |
| ------ | ---------------- | --------------------------- |
| `r`    | 1                | one row per channel         |
| `rg`   | 2                | one row per channel pair    |
| `rgb`  | 3                | one row per channel triple  |
| `rgba` | 4                | one row per channel quartet |

When no explicit format is provided by code, `float.tex` infers the format from channel count:

- `Float32Array` or `[r]` → `r`
- `[r, g]` → `rg`
- `[r, g, b]` → `rgb`
- `[r, g, b, a]` and longer channel arrays → `rgba`

Object-shaped interleaved messages with explicit `width`/`height` validate `data.length === width * height * componentCount`, where `componentCount` comes from `type`. `type: 'rgba'` data can upload without repacking; `r`, `rg`, and `rgb` are expanded into RGBA rows with missing components filled from the extra pixel value. Shared-buffer messages use the same pixel layout, require `buffer.byteLength === width * height * componentCount * 4`, and only upload when `version` changes for that buffer.

Object-shaped inputs may set `textureFormat` to choose output texture storage:

| Texture format | Meaning                                      |
| -------------- | -------------------------------------------- |
| `rgba32f`      | Default. Full 32-bit float storage.          |
| `rgba16f`      | Half-float storage for lower memory use.     |
| `rgba8`        | 8-bit normalized storage, clamped to `0..1`. |

For longer channel arrays, `rgba` creates additional rows per group of four channels.

For each pixel:

- Pixel `x` uses sample index `x`.
- Pixel `y` uses channel group `y`.
- Channels missing from an incomplete group are filled from the extra pixel value.
- Channels inside a group must have the same sample count; mismatches are validation errors shown on the node.

## Layout Contract

Channel packing supports three layouts:

| Layout    | Meaning                                                                |
| --------- | ---------------------------------------------------------------------- |
| `rows`    | Default. Each channel group becomes one texture row.                   |
| `wrapped` | Each channel group starts on a new row, but long rows wrap by `width`. |
| `square`  | Channel groups are appended into an approximately square texture.      |

`rows` is selected by plain `Float32Array` and `Float32Array[]` input.

`wrapped` is selected with `{ type: 'wrapped', channels, width }`. `channels` is a `Float32Array`, `Float32Array[]`, `SharedArrayBuffer`, or `SharedArrayBuffer[]`. `width` is required and becomes the output texture width. SharedArrayBuffer channel messages require `version` for dirty checks.

`square` is selected with `{ type: 'square', channels }`. `channels` accepts the same Float32Array or SharedArrayBuffer forms as wrapped layout. SharedArrayBuffer channel messages require `version` for dirty checks. It computes `size = ceil(sqrt(totalPixels))`, where `totalPixels` is the sum of sample counts across channel groups. The output texture is `size x size`, and unused pixels at the end are filled with the extra pixel value.

## Recommended Sequence

1. Add wrapped and square layouts.
   - Wrapped rows should continue long channel data onto additional rows when the sample count exceeds the chosen width.
   - Square layout should pack data into an approximately square texture for point-cloud or particle-style use where pixel order is storage, not display.

2. Add texture format options.
   - Keep `rgba32f` as the default.
   - Consider `rgba16f` and `rgba8` first, then narrower float formats if the renderer path supports them cleanly.

3. Add explicit `r`, `rg`, and `rgb` interleaved object inputs.
   - Accept `{ type, data, width, height }` and `{ type, buffer, width, height, version }` for `r`, `rg`, `rgb`, and `rgba`.
   - Expand narrower interleaved inputs to RGBA internally until narrower texture storage is supported.

4. Add validation and logging in the node UI.
   - Surface dimension and length mismatches near the node instead of relying only on thrown errors or console output.
   - Add small, targeted validation as new layout/format options land.
   - Log packing validation failures with `logger.nodeError()` and avoid repeatedly logging the same message while the input remains unchanged.

5. Add examples and presets.
   - Create a dedicated Float Texture Data preset pack for JS generators that feed `float.tex`.
   - Keep CPU-side JS generators lightweight; geometry position-field generators belong in the GPU Geometry pack.
   - Include a 24 fps SharedArrayBuffer RGBA animation with a bumped `version` per frame.
   - Include `js -> float.tex -> glsl` 2D gradient.
   - Include `tap~ -> float.tex -> glsl` raw audio visualization.
   - Include a particle or point-cloud texture example once square layout exists.

## Deferred

- SAB double-buffer mode for producer/consumer-safe shared texture frames.
- SAB ring-buffer mode for audio-ish continuous histories.
- Custom extra pixel values in the node UI.
- Shared named data texture resources.
