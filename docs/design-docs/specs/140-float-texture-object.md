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
- The MVP packs samples into an `RGBA32F` texture.
- Missing channels are filled with `(0, 0, 0, 1)`.
- The output texture uses nearest filtering and clamp wrapping.
- Channel names are ignored; order controls packing.
- Same-size updates should reuse the existing GPU texture and update its pixels; resizing reallocates the texture and framebuffer.
- The packer may reuse an internal output buffer, but upload transfer should use an owned copy so user-provided input arrays and the reusable pack buffer are not detached.
- Upload transfer buffers should be returned from the render worker after the WebGL upload and reused by `GLSystem` for later same-size uploads.
- Multiple incoming messages in the same animation frame should coalesce into one upload; only the latest packed texture is flushed to the render worker.

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

For longer channel arrays, `rgba` creates additional rows per group of four channels.

For each pixel:

- Pixel `x` uses sample index `x`.
- Pixel `y` uses channel group `y`.
- Channels missing from an incomplete group are filled from the extra pixel value.
- Rows use the longest channel length in that group; shorter channels are padded with the extra pixel value.

## Deferred

- Wrapped rows for arrays longer than max texture width.
- Fit-to-square layout for point-cloud style data.
- Custom extra pixel values in the node UI.
- Half-float / byte output modes.
- Shared named data texture resources.
