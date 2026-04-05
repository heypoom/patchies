# 101. Render Graph Diffing

## Problem

When the render graph changes (e.g., adding/removing an edge or node), `buildFBOs()` recreates **all** renderers even for nodes whose data hasn't changed. This destroys stateful JS-based renderers (canvas, three, regl, SwissGL) that maintain internal state (scene graphs, animation state, custom WebGL resources).

Currently:
- FBO textures/framebuffers are already reused when size matches (prevents black flash)
- But `cleanup()` is always called, destroying the renderer
- Then `createXxxRenderer()` recreates it from scratch
- Textmode already has a reuse pattern (checks if code changed before recreating)

## Solution

Diff old and new render graphs. For each node:

1. **Removed** (in old, not in new): destroy FBO + renderer (already works)
2. **Added** (in new, not in old): create FBO + renderer (already works)
3. **Unchanged** (same id, same type, same data, same size): **skip** — keep existing FBONode entirely
4. **Data changed** (same id, same type, different data): recreate renderer, reuse FBO if size matches

### Implementation

Store a fingerprint of each node's data alongside the FBONode. On rebuild, compare fingerprints to detect changes.

**Key change in `buildFBOs`**: After confirming `canReuseFbo`, also check if node data changed. If both FBO and data are unchanged, skip the node entirely — don't call cleanup or create a new renderer.

For stateful renderers (canvas, three, regl, swgl, hydra), also update the `framebuffer` reference and `inletMap`/`inputs`/`outputs` on the existing render graph node without recreating the renderer.

### Node types and their reuse strategy

| Type | Stateful? | Reuse strategy |
|------|-----------|----------------|
| glsl | No (stateless shader) | Skip if code + uniforms unchanged |
| hydra | Yes | Skip if code unchanged (already has deferred cleanup) |
| canvas | Yes | Skip if code unchanged |
| three | Yes | Skip if code unchanged |
| regl | Yes | Skip if code unchanged |
| swgl | Yes | Skip if code unchanged |
| textmode | Yes | Already reuses (existing pattern) |
| projmap | Yes | Skip if surfaces unchanged |
| img | No | Always skip (empty renderer) |
| bg.out | No | Always skip (empty renderer) |
| send.vdo | No | Recreate (cheap, needs updated inletMap) |
| recv.vdo | No | Recreate (cheap, needs updated inletMap) |

### Edge/connection changes

When only edges change (not node data), existing renderers read their inputs dynamically from `this.fboNodes` via `node.inletMap` at render time. The `inletMap` is set during graph construction in `buildRenderGraph()`, so the render graph nodes carry updated connection info. We need to update the stored render graph but can skip renderer recreation.

For passthrough nodes (send.vdo, recv.vdo) that close over `node.inletMap`, we must recreate them since they capture the inletMap in their closure.
