# 105. Multi-Render-Target (MRT) Output

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

- Add `mrtEnabled` flag to node data (default: false, preserving current behavior)
- When enabled, the ShaderToy wrapper changes:
  - Remove the single `out vec4 fragColor` injection
  - Let user declare their own `layout(location=N) out` variables
  - `mainImage` signature changes to just `void mainImage(vec2 fragCoord)` — user writes to named outputs directly
- Video outlet count becomes configurable (like REGL already is)
- Uniform inlet generation stays the same (top handles), MRT outlets appear at bottom

#### REGL Node

- Already has configurable video outlet count via `setVideoCount()`
- Add `setMRT(true)` API that creates multi-attachment FBO
- User's draw commands write to multiple attachments naturally (regl supports this)
- Each outlet index maps to a color attachment

#### SwissGL Node

- SwissGL's `glsl()` already supports render targets with multiple layers
- Expose outlet-to-layer mapping
- `setVideoCount()` already exists — MRT adds multi-attachment backing

### Pipeline Changes

#### `fboRenderer.ts` — `buildFBOs()`

Currently creates one `regl.framebuffer` with one color attachment per node. Change to:

```typescript
const colorAttachments = node.mrtCount > 1
  ? Array.from({ length: node.mrtCount }, () => regl.texture({ width, height, ...format }))
  : [regl.texture({ width, height, ...format })];

const framebuffer = regl.framebuffer({ colors: colorAttachments, depth: true });
```

Store the individual color textures on the FBONode so they can be routed independently.

#### `fboRenderer.ts` — texture routing

Currently `getInputTextureMap()` looks up `fboNodes.get(sourceNodeId).texture` (singular). Change to:

```typescript
// edge.sourceHandle encodes which outlet: "video-out-0", "video-out-1", etc.
const outletIndex = parseOutletIndex(edge.sourceHandle);
const sourceTexture = sourceFboNode.colorAttachments[outletIndex];
textureMap.set(inletIndex, sourceTexture);
```

#### `graphUtils.ts` — edge parsing

Currently only parses inlet index from `targetHandle`. Also parse outlet index from `sourceHandle` to know which attachment to read from.

### Backwards Compatibility

- Default `mrtCount = 1` — existing nodes unchanged
- Single-outlet GLSL nodes keep the current ShaderToy wrapper
- MRT is opt-in per node

### Limits

- WebGL2 guarantees at least 4 color attachments (`MAX_DRAW_BUFFERS >= 4`)
- Cap at 4 outlets for MRT mode
- All attachments share the same dimensions (inherent to FBOs)
- All attachments share the same format (simplification; could relax later)
