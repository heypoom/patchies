# 112. Configurable FBO Format (Float Textures) ✓

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

Parsed from code on each update, same pattern as MRT count detection (`detectMrtCount` parses `layout(location = N) out`). A `detectFboFormat()` function strips block comments only, then matches the directive in `//` single-line comments:

```javascript
/\/\/\s*@format\s+(rgba8|rgba16f|rgba32f)/
```

If no directive is found, returns `'rgba8'` (not `undefined` — see fingerprint note below).

The directive is also syntax-highlighted in the GLSL CodeMirror editor with muted colors to distinguish it from active code.

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

In `buildFBOs()`, read format from node data and create textures via `createFboTexture()`:

```typescript
const fboFormat: FBOFormat =
  ((node.data as Record<string, unknown>)?.fboFormat as FBOFormat) || 'rgba8';
```

**regl bypass**: regl is a WebGL1 library that doesn't support WebGL2 sized internal formats (`RGBA16F`, `RGBA32F`). It always sets `internalformat = format = GL_RGBA`, which is invalid for float textures in WebGL2. The workaround:

1. Create a standard `uint8` texture via `regl.texture()` (so regl tracks it)
2. Re-initialize the underlying GL texture with the correct format via raw WebGL2:

```typescript
gl.bindTexture(gl.TEXTURE_2D, rawTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
```

This also requires shimming `gl.getExtension()` to return truthy values for WebGL1 extension names (`OES_texture_float`, `OES_texture_half_float`) that regl checks but which return null on WebGL2 (where they're core).

This applies to both regular color attachments and feedback (previous-frame) textures.

**FBO reuse check**: `canReuseFbo` compares `existingFbo.fboFormat` against the requested format. When format changes, the old FBO is destroyed and a new one is created.

**Fingerprint**: `fboFormat` must be a concrete value (`'rgba8'`), not `undefined`, because `JSON.stringify` strips `undefined` keys — making format changes invisible to the fingerprint diff.

### Float Texture Filtering

Float texture **linear filtering** (bilinear/trilinear sampling) depends on optional extensions:

- `rgba16f` — requires `OES_texture_half_float_linear`. Widely supported but not guaranteed.
- `rgba32f` — requires `OES_texture_float_linear`. Less common.

If the respective extension is missing, fall back to `nearest` sampling for that format. Note: `EXT_float_blend` is a separate extension that controls whether float render targets support alpha blending — it is unrelated to texture filtering.

Checked once at init via `gl.getExtension()`, stored as `halfFloatLinearSupported` / `floatLinearSupported`, and used in `createFboTexture()` to set the appropriate `TEXTURE_MIN_FILTER` / `TEXTURE_MAG_FILTER`.

### Preview Rendering

The preview canvas (`transferFromImageBitmap`) expects RGBA8 bitmaps. When `readPixels` reads from a float FBO into a `Uint8Array`, WebGL implicitly clamps values to [0, 255] — so previews display clamped colors without extra work. The actual float texture passed between nodes is unaffected.

### Backwards Compatibility

- Default is `rgba8` — no change for existing patches
- Format is per-node, not global — nodes can mix formats freely
- Downstream nodes don't need to know the upstream format (WebGL2 texture sampling works the same)
