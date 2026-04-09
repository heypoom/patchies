# 112. Configurable FBO Format (Float Textures)

## Problem

The inter-node FBO pipeline uses RGBA8 (`unsigned byte`) textures exclusively. Values are clamped to [0, 1] with 8-bit precision per channel. This makes GPGPU patterns impossible across nodes — particle positions, velocity fields, signed distance fields, and HDR data all need float precision and unclamped ranges.

SwissGL already supports float formats internally (`rgba16f`, `rgba32f`), but the inter-node FBOs created by `fboRenderer.ts` are always RGBA8. So float data can't cross a wire.

## Solution

Add a per-node `fboFormat` setting that controls the texture format of its output FBO. Downstream nodes sample the texture the same way regardless of format (WebGL2 handles this transparently).

### Supported Formats

| Format | Bits/channel | Range | Use case |
|--------|-------------|-------|----------|
| `rgba8` | 8 | [0, 1] | Default. Color, visual output |
| `rgba16f` | 16 float | ±65504 | HDR, moderate-precision data |
| `rgba32f` | 32 float | full float | GPGPU, physics, positions |

### Node Data Change

Add optional `fboFormat` field to visual node data:

```typescript
interface VisualNodeData {
  // ... existing fields
  fboFormat?: 'rgba8' | 'rgba16f' | 'rgba32f';  // default: 'rgba8'
}
```

### How Users Set the Format

Code-first — no UI knobs. The format is declared in user code, matching each node type's language.

#### GLSL / SwissGL — Comment Directive

```glsl
// @format rgba32f

void main() {
  fragColor = vec4(position, velocity, 0.0);
}
```

Parsed from code on each update, same pattern as MRT count detection (`detectMrtCount` parses `layout(location = N) out`). A `detectFboFormat()` function strips comments, matches `// @format <value>`, and writes `fboFormat` into node data.

Only `// @format` lines that are **not** inside block comments are matched. The regex strips comments first (same approach as `detectMrtCount`), then matches:

```
/@format\s+(rgba8|rgba16f|rgba32f)/
```

If no directive is found, defaults to `rgba8`.

#### JS Nodes (Hydra, REGL, Three, Canvas) — API Function

```javascript
setTextureFormat('rgba32f');
```

Works like existing JS API functions (`setTitle()`, `flash()`). Sends a message to the main thread to update `fboFormat` in node data, which triggers FBO rebuild on next `buildFBOs()` cycle.

The function is called once at init (not per-frame). Calling it again with a different value triggers a rebuild.

#### Summary

| Node type | Mechanism | Example |
|-----------|-----------|---------|
| glsl, swgl | `// @format rgba32f` comment directive | Parsed from code on change |
| hydra, regl, three, canvas | `setTextureFormat('rgba32f')` JS API | Message to main thread |

### Pipeline Change — `fboRenderer.ts`

In `buildFBOs()`, read format from node data:

```typescript
const format = node.data.fboFormat ?? 'rgba8';
const textureType = match(format)
  .with('rgba8', () => 'uint8')
  .with('rgba16f', () => 'float16')
  .with('rgba32f', () => 'float32')
  .exhaustive();

const texture = regl.texture({
  width, height,
  type: textureType,
  format: 'rgba',
});
```

This applies to both regular color attachments and feedback (previous-frame) textures.

Fingerprint already includes `fboFormat` (via `JSON.stringify(node.data)`), so FBOs are automatically recreated when format changes.

### Float Texture Filtering

Float texture **linear filtering** (bilinear/trilinear sampling) depends on optional extensions:

- `rgba16f` — requires `OES_texture_half_float_linear`. Widely supported but not guaranteed.
- `rgba32f` — requires `OES_texture_float_linear`. Less common.

If the respective extension is missing, fall back to `nearest` sampling for that format. Note: `EXT_float_blend` is a separate extension that controls whether float render targets support alpha blending — it is unrelated to texture filtering.

Check for these extensions once at init and store the capabilities so `buildFBOs()` can set the appropriate `min`/`mag` filter per format.

### Preview Rendering

The preview canvas (`transferFromImageBitmap`) expects RGBA8 bitmaps. For float FBOs, the PixelReadbackService already reads pixels — just needs to clamp/tonemap when reading from float FBOs for preview display. The actual texture passed between nodes stays float.

### Backwards Compatibility

- Default is `rgba8` — no change for existing patches
- Format is per-node, not global — nodes can mix formats freely
- Downstream nodes don't need to know the upstream format (WebGL2 texture sampling works the same)
