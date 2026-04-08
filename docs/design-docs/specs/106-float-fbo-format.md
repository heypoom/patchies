# 106. Configurable FBO Format (Float Textures)

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

Fingerprint must include `fboFormat` so FBOs are recreated when format changes.

### UI — Settings Panel

Add a dropdown to the node settings panel for visual nodes:

- Label: "Texture Format"
- Options: `RGBA8` (default), `Half Float (16f)`, `Float (32f)`
- Only shown when node type is glsl, regl, swgl, three, hydra
- Changing format triggers FBO rebuild

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
