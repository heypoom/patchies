# 111. Multi-Render-Target (MRT) Output

## Status: Implemented ✓

Core MRT is fully working. The one remaining known gap (dangling outlet edges after `mrtCount` decrease) has been fixed.

### Bug fixes

- **drawBuffers warning**: Removed redundant per-frame `gl.drawBuffers()` call from `renderFboNode`. In WebGL2, `drawBuffers` is per-FBO state set once during `buildFBOs` — regl never touches it (the `WEBGL_draw_buffers` extension doesn't exist on WebGL2 contexts). The per-frame call was hitting the default framebuffer when regl's state tracking was stale, producing "INVALID_OPERATION: drawBuffers: the number of buffers is not 1".

- **Intermittent black outputs on load**: Serialized `buildFBOs` calls in `renderWorker.ts`. Previously, if a Hydra renderer's `setVideoCount()` triggered a rebuild during the initial build's async Phase 2, two `buildFBOs` ran concurrently with interleaving Phase 3 overwrites to `this.fboNodes`, leaving some nodes with stale or missing renderers.

---

## Problem

Every visual node outputs exactly one texture (one FBO color attachment). A single GLSL shader that computes albedo, normal, and roughness must be run three times with a mode switch, or all downstream processing must happen inside the same node. There's no way to fan out structured multi-channel data from a single shader pass.

WebGL2 natively supports MRT via `drawBuffers` — a single fragment shader can write to up to 4 color attachments simultaneously. The rendering pipeline doesn't expose this.

## Solution

Allow GLSL, REGL, and SwissGL nodes to output multiple textures from one draw call, each routed through a separate video outlet.

### How It Works

**Fragment shader side** (GLSL node example):

```glsl
layout(location = 0) out vec4 fragColor;   // outlet 0 — e.g. albedo
layout(location = 1) out vec4 fragNormal;   // outlet 1 — e.g. normal
layout(location = 2) out vec4 fragData;     // outlet 2 — e.g. roughness/metallic
```

**FBO creation**: Instead of one color attachment, create N color attachments per node (N = number of video outlets when MRT is enabled).

**Outlet routing**: Video outlet index maps directly to color attachment index. Downstream nodes receive the corresponding texture.

### Node-Level Changes

#### GLSL Node ✓

- `mrtCount` is **auto-detected** from the shader code on every compile — no flag or UI control needed.
- Detection: strip single-line and block comments, then scan for `layout(location=N) out` declarations, take `max(N) + 1`. If none found, `mrtCount = 1` (standard mode).
- When `mrtCount > 1`, the ShaderToy wrapper changes:
  - Remove the single `out vec4 fragColor` injection
  - Let user declare their own `layout(location=N) out` variables
  - `mainImage` signature changes to just `void mainImage(vec2 fragCoord)` — user writes to named outputs directly
- Outlet handles switch from a single `video-out-out` to numbered `video-out-0`, `video-out-1`, … `video-out-N`
- Uniform inlet generation stays the same (top handles), MRT outlets appear at bottom

**Example — 3-output MRT shader (no configuration needed):**

```glsl
layout(location = 0) out vec4 albedo;
layout(location = 1) out vec4 normal;
layout(location = 2) out vec4 roughness;

void mainImage(vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  albedo   = vec4(uv, 0.0, 1.0);
  normal   = vec4(0.0, 0.0, 1.0, 1.0);
  roughness = vec4(0.5, 0.5, 0.5, 1.0);
}
```

Writing these declarations automatically gives the node 3 video outlets. Removing them reverts to single-output mode.

#### REGL Node ✓

- `mrtCount` is set via `videoOutletCount` in node data (no auto-detection — REGL code is JS, not GLSL)
- User's draw commands write to multiple attachments naturally (regl supports this)
- Each outlet index maps to a color attachment

#### SwissGL Node ⚠️ (partial)

- `mrtCount` is set via `videoOutletCount` in node data (propagated as `mrtCount` to FBO allocation)
- **Not yet supported for single-pass MRT**: SwissGL's `glsl()` manages its own framebuffer
  binding via `bindTarget` and provides no way for user code to direct a draw call to a
  specific color attachment index. Multiple outlets are created correctly, but only
  `COLOR_ATTACHMENT0` receives rendered output — the remaining attachments stay black.
- Future work: extend the SwissGL renderer with an `attachment` parameter on `glsl()` calls
  so each pass can target a specific outlet.

### Pipeline Changes

#### `fboRenderer.ts` — `buildFBOs()` ✓

Creates `mrtCount` color attachments per node. For MRT nodes (mrtCount > 1), regl is used to allocate individual textures and the framebuffer's extra attachments are bound manually via raw WebGL2 (regl's `framebuffer()` only accepts a single `color` argument):

```typescript
// Allocate one texture per outlet
colorAttachments = Array.from({length: mrtCount}, () =>
  this.regl.texture({width, height, wrapS: 'clamp', wrapT: 'clamp'}),
)

// Build framebuffer, then attach remaining textures via raw WebGL2
const fb = this.regl.framebuffer({
  color: colorAttachments[0],
  depthStencil: false,
})
for (let i = 1; i < colorAttachments.length; i++) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, getFramebuffer(fb))
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0 + i,
    gl.TEXTURE_2D,
    getRawTexture(colorAttachments[i]),
    0,
  )
}
gl.drawBuffers(colorAttachments.map((_, i) => gl.COLOR_ATTACHMENT0 + i))
```

The `FBONode` type (`rendering/types.ts`) supports multiple color attachments:

```typescript
export interface FBONode {
  id: string
  framebuffer: regl.Framebuffer2D
  /** All color attachments — one per MRT outlet. Single-output nodes have exactly one entry. */
  colorAttachments: regl.Texture2D[]
  /** Alias for colorAttachments[0]. Kept for backwards compatibility. */
  texture: regl.Texture2D
  render: RenderFunction
  cleanup?: () => void
  dataFingerprint?: string
  nodeType?: RenderNode['type']
  /** Previous frame textures — one per color attachment, only allocated for feedback nodes */
  prevTextures?: regl.Texture2D[]
  /** Previous frame framebuffers — one per color attachment, only allocated for feedback nodes */
  prevFramebuffers?: regl.Framebuffer2D[]
}
```

#### `fboRenderer.ts` — texture routing ✓

`getInputTextureMap()` iterates `node.inletMap` which maps `inletIndex → { sourceNodeId, outletIndex }` and reads the correct color attachment:

```typescript
for (const [inletIndex, {sourceNodeId, outletIndex}] of node.inletMap) {
  const inputFBO = this.fboNodes.get(sourceNodeId)
  if (inputFBO) {
    // For back-edge inlets (feedback loops), read from the previous frame's texture
    if (node.backEdgeInlets.has(inletIndex) && inputFBO.prevTextures?.length) {
      const prevTex =
        inputFBO.prevTextures[outletIndex] ?? inputFBO.prevTextures[0]
      textureMap.set(inletIndex, prevTex)
    } else {
      // Index into the correct color attachment for MRT sources
      const texture =
        inputFBO.colorAttachments[outletIndex] ?? inputFBO.colorAttachments[0]
      textureMap.set(inletIndex, texture)
    }
  }
}
```

#### `fboRenderer.ts` — feedback (back-edges) ✓

For feedback nodes in MRT mode, one `prevTexture`/`prevFramebuffer` pair is allocated per color attachment so every outlet has independent previous-frame data:

```typescript
fboNode.prevTextures = fboNode.colorAttachments.map(() =>
  this.regl.texture({width, height, wrapS: 'clamp', wrapT: 'clamp'}),
)
fboNode.prevFramebuffers = fboNode.prevTextures.map((prevTexture) =>
  this.regl.framebuffer({color: prevTexture, depthStencil: false}),
)
```

The blit loop iterates each attachment separately, switching the read buffer before each blit:

```typescript
gl.bindFramebuffer(gl.READ_FRAMEBUFFER, getFramebuffer(fboNode.framebuffer))
for (let i = 0; i < fboNode.prevFramebuffers.length; i++) {
  gl.readBuffer(gl.COLOR_ATTACHMENT0 + i)
  gl.bindFramebuffer(
    gl.DRAW_FRAMEBUFFER,
    getFramebuffer(fboNode.prevFramebuffers[i]),
  )
  gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST)
}
gl.bindFramebuffer(gl.FRAMEBUFFER, null)
```

#### `graphUtils.ts` — outlet index parsing ✓

`inletMap` is extended from `Map<number, string>` to `Map<number, { sourceNodeId: string; outletIndex: number }>` so each inlet records which outlet of its source it reads from.

`parseOutletIndex` parses the outlet index from edge `sourceHandle` strings. Handles both numeric MRT handles (`video-out-1` → 1) and the legacy single-output handle (`video-out-out` → 0) for full backwards compatibility:

```typescript
export function parseOutletIndex(sourceHandle: string | undefined): number {
  if (!sourceHandle?.startsWith('video-out')) return 0
  const match = sourceHandle.match(/video-out-(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}
```

### Auto-Detection (GLSL) ✓

On every shader compile (`updateShader()`), comments are stripped first, then scan for `layout(location=N) out` declarations and derive `mrtCount`:

```typescript
function detectMrtCount(code: string): number {
  // Strip comments so commented-out declarations don't inflate the count
  const stripped = code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const locationRegex = /layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out/g
  let max = -1,
    match
  while ((match = locationRegex.exec(stripped)) !== null) {
    max = Math.max(max, parseInt(match[1], 10))
  }
  return max >= 0 ? max + 1 : 1
}
```

`mrtCount` is written to node data alongside `glUniformDefs`. No directive, no UI control — the shader declarations are the single source of truth.

### Backwards Compatibility ✓

- Default `mrtCount = 1` — existing nodes unchanged
- Single-outlet GLSL nodes with no `layout(location=N) out` declarations keep the current ShaderToy wrapper and single-outlet handle
- Existing edges to `video-out-out` continue to work (parsed as outlet index 0)

### Edge cleanup on mrtCount decrease ✓

When a GLSL node's `mrtCount` decreases, `removeInvalidEdges()` is called with the new count before updating node data. It filters source edges whose `video-out-N` handle index is ≥ the new `mrtCount` and passes them to `deleteElements()`, keeping the graph consistent.

### Limits

- WebGL2 guarantees at least 4 color attachments (`MAX_DRAW_BUFFERS >= 4`)
- Cap at 4 outlets for MRT mode
- All attachments share the same dimensions (inherent to FBOs)
- All attachments share the same format (simplification; could relax later)
