# 113. Graph-Level Feedback Loops

## Problem

The render graph uses topological sort, which rejects cycles. Feedback (wiring a downstream node's output back upstream) only works *inside* a single node — SwissGL ping-pong, Hydra's internal feedback. You can't build a multi-node feedback chain like `blur → warp → accumulate → feed back to blur`.

Feedback is one of the most powerful techniques in visual programming. TouchDesigner's Feedback TOP is one of its most-used operators.

## Solution

Allow cycles in the render graph by detecting back-edges and rendering them with a 1-frame delay. Back-edges read from the previous frame's texture instead of the current frame's.

### Core Concept

A **back-edge** is a graph edge that creates a cycle. When the topological sort encounters a cycle, it identifies the edge(s) that need to be "broken" to make the graph acyclic. These broken edges become back-edges.

At render time, a back-edge's source provides the texture from frame N-1, not frame N. This is the standard approach used by TouchDesigner, Max/MSP/Jitter, and ISF.

### Double-Buffered FBOs

Nodes involved in feedback loops need two FBO textures:

- **Current**: written to during this frame's render pass
- **Previous**: holds last frame's output, read by back-edge consumers

After each frame, swap current ↔ previous.

```typescript
interface FBONode {
  // existing
  framebuffer: regl.Framebuffer2D;
  texture: regl.Texture2D;
  // new
  prevTexture?: regl.Texture2D;       // previous frame (only for feedback nodes)
  prevFramebuffer?: regl.Framebuffer2D;
  isInFeedbackLoop: boolean;
}
```

### Graph Analysis — `graphUtils.ts`

Replace the current topological sort (which rejects cycles) with one that handles them:

1. **Detect back-edges** using DFS. When a DFS visits a node already on the current stack, the edge leading to it is a back-edge.
2. **Remove back-edges** from the graph temporarily.
3. **Topological sort** the remaining acyclic graph — this is the render order.
4. **Annotate back-edges** on the render graph so the renderer knows which inputs use previous-frame textures.

```typescript
interface RenderGraph {
  sortedNodes: string[];
  nodes: RenderNode[];
  backEdges: Set<string>;       // edge IDs that are back-edges
  feedbackNodes: Set<string>;   // node IDs that need double-buffering
}
```

### Rendering — `fboRenderer.ts`

#### FBO Creation

For nodes in `feedbackNodes`, allocate two textures + two framebuffers instead of one.

#### Texture Routing

In `getInputTextureMap()`, check if the edge is a back-edge:

```typescript
if (this.renderGraph.backEdges.has(edgeId)) {
  // Read from previous frame
  textureMap.set(inletIndex, sourceFboNode.prevTexture);
} else {
  // Read from current frame (existing behavior)
  textureMap.set(inletIndex, sourceFboNode.texture);
}
```

#### Frame End — Swap Buffers

After rendering all nodes in a frame:

```typescript
for (const nodeId of this.renderGraph.feedbackNodes) {
  const fboNode = this.fboNodes.get(nodeId);
  // Swap current and previous
  [fboNode.framebuffer, fboNode.prevFramebuffer] = [fboNode.prevFramebuffer, fboNode.framebuffer];
  [fboNode.texture, fboNode.prevTexture] = [fboNode.prevTexture, fboNode.texture];
}
```

### First Frame Bootstrap

On the first frame (or when a feedback loop is first created), `prevTexture` is uninitialized. Initialize it as a cleared (black transparent) texture. This matches standard behavior — feedback starts from nothing and accumulates.

### UI Indicators

Back-edges should be visually distinct so users understand the 1-frame delay:

- **Dashed edge style** for back-edges (vs solid for normal edges)
- **Tooltip on hover**: "Feedback (1-frame delay)"
- Consider a small "feedback" badge or icon on the edge

Detection can happen in the Svelte flow layer by checking if an edge ID is in the `backEdges` set (stored on GLSystem or exposed to the store).

### Edge Cases

**Multiple back-edges in one cycle**: Only one needs to be broken. The DFS picks the edge that completes the cycle (the one pointing to an ancestor in the DFS tree).

**Nested cycles**: Each cycle gets its own back-edge. A node can appear in multiple cycles — it still only needs one double-buffer.

**Adding/removing edges that create/break cycles**: Handled by `buildRenderGraph()` rerun. Double-buffer allocation is idempotent — adding a prevTexture to a node that already has one is a no-op.

**Performance**: Double-buffered nodes use 2x texture memory. Only nodes actually in feedback loops pay this cost. For a typical patch with 1-2 feedback loops, this is negligible.

### Backwards Compatibility

- Graphs without cycles behave identically to today
- No new node types needed — feedback is a property of the graph topology
- Existing patches with no cycles load unchanged
