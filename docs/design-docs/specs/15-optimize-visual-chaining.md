# 15. Optimize Visual Chaining with Framebuffers

Right now, the visual chaining system in our graphics engine is not optimized for performance. It uses `texture.subimage` from REGL to send the texture data of the `HTML5Canvas` to the GPU, which is not efficient for large textures or frequent updates.

To improve this, we will implement a framebuffer-based system for the `GLSLCanvasManager` that allows us to render directly to textures without the overhead of `subimage`.

The challenge is that most nodes are not compatible with framebuffers, such as `p5` (by default) and `canvas` nodes. Some nodes like `hydra` also use their own WebGL rendering context, so we can't capture their framebuffer due to isolation.

We need to mark `glsl` nodes as compatible with framebuffers. If an object is not framebuffer-compatible, we will fall back to `texture.subimage(canvas)` to copy from CPU to GPU. We try to use framebuffers when possible.

In the future, we will try to make more nodes compatible with framebuffers, but for now we will focus on the `glsl` nodes.

## Idea

- We should have a single rendering context, so memory buffers are shared across all nodes in the GPU.
- Create a single `OffscreenCanvas` as the rendering context.
- For rendering previews of each shader step, use `bitmaprenderer` which is highly optimized for displaying parts of the `OffscreenCanvas`.
- We should be able to capture the image at each step of the visual chain. We should have to choice to hide the preview for improved performance (i.e. no `transferToImageBitmap` for that particular node).
- We will implement nested patches and abstractions soon, which means that in the future we may not care about image previews at all for some nodes (as they are nested and is not visible), but we will need the image outputs for those.

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
