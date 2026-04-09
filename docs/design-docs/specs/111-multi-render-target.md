# 111. Multi-Render-Target (MRT) Output

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

#### GLSL Node

- `mrtCount` is **auto-detected** from the shader code on every compile — no flag or UI control needed.
- Detection: scan for `layout(location=N) out` declarations, take `max(N) + 1`. If none found, `mrtCount = 1` (standard mode).
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

#### REGL Node

- `mrtCount` is set via node data (no auto-detection — REGL code is JS, not GLSL)
- User's draw commands write to multiple attachments naturally (regl supports this)
- Each outlet index maps to a color attachment

#### SwissGL Node

- `mrtCount` is set via node data (no auto-detection — SwissGL code is JS, not GLSL)
- **Not yet supported for single-pass MRT**: SwissGL's `glsl()` manages its own framebuffer
  binding via `bindTarget` and provides no way for user code to direct a draw call to a
  specific color attachment index. Multiple outlets are created correctly, but only
  `COLOR_ATTACHMENT0` receives rendered output — the remaining attachments stay black.
- Future work: extend the SwissGL renderer with an `attachment` parameter on `glsl()` calls
  so each pass can target a specific outlet.

### Pipeline Changes

#### `fboRenderer.ts` — `buildFBOs()`

Currently creates one `regl.framebuffer` with one color attachment per node. Change to:

```typescript
const colorAttachments =
  node.mrtCount > 1
    ? Array.from({length: node.mrtCount}, () =>
        regl.texture({width, height, ...format}),
      )
    : [regl.texture({width, height, ...format})]

const framebuffer = regl.framebuffer({colors: colorAttachments, depth: true})
```

Update the `FBONode` type (`rendering/types.ts`) to support multiple color attachments:

```typescript
export interface FBONode {
  id: string
  framebuffer: regl.Framebuffer2D
  colorAttachments: regl.Texture2D[] // one texture per color attachment
  /** @deprecated Use colorAttachments[0]. Kept for backwards compat. */
  texture: regl.Texture2D
  render: RenderFunction
  cleanup?: () => void
  dataFingerprint?: string
  nodeType?: RenderNode['type']
}
```

When constructing a FBONode, populate both fields:

```typescript
const fboNode: FBONode = {
  // ...
  colorAttachments,
  texture: colorAttachments[0], // backwards-compat alias
}
```

Existing code that reads `fboNode.texture` (e.g. `getInputTextureMap`) continues to work unchanged for single-attachment nodes. MRT-aware consumers index into `colorAttachments` instead.

#### `fboRenderer.ts` — texture routing

Currently `getInputTextureMap()` iterates `node.inletMap` which maps `inletIndex → sourceNodeId` and reads `inputFBO.texture` (singular). To support MRT, the inlet map must also carry the source outlet index so the correct color attachment is selected:

```typescript
// In getInputTextureMap():
for (const [inletIndex, {sourceNodeId, outletIndex}] of node.inletMap) {
  const inputFBO = this.fboNodes.get(sourceNodeId)
  if (inputFBO) {
    textureMap.set(inletIndex, inputFBO.colorAttachments[outletIndex])
  }
}
```

#### `graphUtils.ts` — outlet index parsing

`inletMap` is extended from `Map<number, string>` to `Map<number, { sourceNodeId: string; outletIndex: number }>` so each inlet records which outlet of its source it reads from.

`parseOutletIndex` parses the outlet index from edge `sourceHandle` strings. Handles both numeric MRT handles (`video-out-1` → 1) and the legacy single-output handle (`video-out-out` → 0) for full backwards compatibility:

```typescript
export function parseOutletIndex(sourceHandle: string | undefined): number {
  if (!sourceHandle?.startsWith('video-out')) return 0
  const match = sourceHandle.match(/video-out-(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}
```

Used when building `inletMap` from edges in `filterFBOCompatibleGraph()` so MRT outlet indices propagate through the render graph into `getInputTextureMap()`.

### Auto-Detection (GLSL)

On every shader compile (`updateShader()`), scan for `layout(location=N) out` declarations and derive `mrtCount`:

```typescript
function detectMrtCount(code: string): number {
  const locationRegex = /layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out/g
  let max = -1,
    match
  while ((match = locationRegex.exec(code)) !== null) {
    max = Math.max(max, parseInt(match[1], 10))
  }
  return max >= 0 ? max + 1 : 1
}
```

`mrtCount` is written to node data alongside `glUniformDefs`. No directive, no UI control — the shader declarations are the single source of truth.

### Backwards Compatibility

- Default `mrtCount = 1` — existing nodes unchanged
- Single-outlet GLSL nodes with no `layout(location=N) out` declarations keep the current ShaderToy wrapper and single outlet handle
- Existing edges to `video-out-out` continue to work (parsed as outlet index 0)

### Limits

- WebGL2 guarantees at least 4 color attachments (`MAX_DRAW_BUFFERS >= 4`)
- Cap at 4 outlets for MRT mode
- All attachments share the same dimensions (inherent to FBOs)
- All attachments share the same format (simplification; could relax later)
