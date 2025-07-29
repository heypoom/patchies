# 15. Optimize Visual Chaining with Framebuffer nodes (FBOs)

Right now, the visual chaining system in our graphics engine is not optimized for performance at all. It uses `texture.subimage()` from REGL to send the texture data of the `HTML5Canvas` to the GPU, which is not efficient for large textures or frequent updates. Using 4 nodes could easily take you from 120FPS to 20FPS, which is unacceptable.

To improve this, we will implement a FBO-based system for the `glsl` nodes that allows us to render directly to textures without the overhead of `texture.subimage()` calls. The goal is to try to do GPU-to-GPU transfers as much as possible. We should also avoid `gl.readPixels()`, `canvas.toDataURL()`, `canvas.toBlob()` at all costs.

## In detail

- We must a single `OffscreenCanvas` as the rendering context. We then grab a single `WebGLRenderingContext` from that OffscreenCanvas. This should be managed by the `GLSLCanvasManager`, and it should be the only canvas we need.
  - We should have a single rendering context, so memory buffers are shared across all nodes in the GPU. This is important for ensuring maximal GPU-to-GPU transfers.
- Each `glsl` node's shader output should render to its own dedicated FBO with an attached texture. This texture effectively stores the result of that node's computation.
  - We could also look into FBO pooling, where we reuse FBOs instead of creating new ones every time.
- When a `glsl` node needs input from a previous node, we directly bind the output texture of the upstream node as a texture uniform in the downstream node's shader.
  - We no longer need to use `texture.subimage()` for these nodes, as they will directly read from the GPU texture.
- For rendering previews of each shader step, use `bitmaprenderer` which is highly optimized for displaying parts of the `OffscreenCanvas`.
- We should be able to capture the image at each step of the visual chain.
  - In the future, we should have an option to hide the preview for improved performance (i.e. skip `transferToImageBitmap` for a particular node).
- We will implement nested patches and abstractions soon, which means that in the future we may not care about image previews at all for a large graph (as they are nested and is not visible), but we will still need the image outputs for those.
  - This is a perfect use case for OffscreenCanvas and FBOs.
- Make sure to use the REGL library.
- The biggest challenge is that most nodes are not compatible with framebuffers, such as `p5` (by default) and `canvas` nodes. Some nodes like `hydra` also use their own WebGL rendering context, so we can't capture their framebuffer due to isolation.
  - We need to mark the `glsl` node as compatible with FBO. If an node is not framebuffer-compatible, we will fall back to `texture.subimage(canvas)` to copy from CPU to GPU. We try to use framebuffers when possible.
  - In the future, we will try to make more nodes compatible with framebuffers, but for now we will focus on the `glsl` node.

## Affected Files

- `ui/src/lib/canvas/GLSLCanvasManager.ts`
- `ui/src/lib/components/nodes/GLSLCanvasNode.svelte`

## Example of OffscreenCanvas Usage

```ts
// preview s
const one = document.getElementById('one').getContext('bitmaprenderer')
const two = document.getElementById('two').getContext('bitmaprenderer')

const offscreen = new OffscreenCanvas(256, 256)
const gl = offscreen.getContext('webgl')

// Perform some drawing for the first canvas using the gl context
const bitmapOne = offscreen.transferToImageBitmap()
one.transferFromImageBitmap(bitmapOne)

// Perform some more drawing for the second canvas
const bitmapTwo = offscreen.transferToImageBitmap()
two.transferFromImageBitmap(bitmapTwo)
```
