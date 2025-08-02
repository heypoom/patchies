# 15. Optimize Visual Chaining with Framebuffer nodes (FBOs)

Right now, the visual chaining system in our graphics engine is not optimized for performance. It uses `texture.subimage()` from REGL to send the texture data of the `HTML5Canvas` from the CPU to the GPU. Using 4 nodes could easily take you from 120FPS to 20FPS, which is unacceptable.

To improve this, we will implement a FBO-based system for the `glsl` nodes that allows us to render to textures without the overhead of `texture.subimage()` calls. The goal is to try to do GPU-to-GPU transfers as much as possible. We should reduce `gl.readPixels()`, `canvas.toDataURL()`, `canvas.toBlob()` calls to avoid CPU-GPU transfers.

## Overview

Using the `nodes` and `edges` data from XYFlow, we want to derive a **rendering graph** for GLSL rendering, `glslRenderGraph` in `GLContextManager`.

In `ui/src/lib/canvas/GLSLCanvasManager.ts`, I have a working toy example of how you can use the previous node's framebuffer as a texture input for the next node's shader. This allows us to chain nodes together without needing to copy data back to the CPU.

Each node currently takes in 4 textures as input, which is uniform iChannel0-3. We must look at the graph and construct a correct order of rendering.

```ts
this.frameHandle = this.regl.frame((context) => {
  nodeAframebuffer.use(() => {
    nodeA({textures: [fallbackTexture]})
  })

  // use the output of node A as input for node B
  nodeB({textures: [nodeAframebuffer]})
})
```

We have to:

1. Filter the nodes and edges that are compatible with framebuffers. For now, this will be the `glsl` nodes.
2. Topologically sort the nodes to ensure that we render them in the correct order.
3. When we have the topologically sorted nodes, we can render them in a single frame loop using REGL.

```js
// these should call `DrawToFbo` under the hood.
const render = (source: N, inputs: N[] = []): regl.Framebuffer2D => {}

// we want to also show small previews of each node.
// a user may hide some nodes, so we need to handle that.
const preview = (nodeId: string, fbo: regl.Framebuffer2D) => {}

frame(() => {
  const A = render('A')
  const B = render('B')
  const C = render('C')
  const D = render('D', [A, B, C])
  const E = render('E', [B, C])
  const F = render('F', [D, E])

  // output the big result to screen.
  // this is the final output node that renders to OffscreenCanvas.
  // for the high-quality output.
  output('F', F)

  preview('B', B)
  preview('C', C)
})
```

## Output

- By default, the node connected to the `bg.out` node will be used as the output for the big OffscreenCanvas.
- There should only be one node connected to `bg.out` in the graph. If there are multiple, we will use the first connection we find and ignore the rest.
- There should only be a single `bg.out` node in the graph. If there are multiple, we use the first node we find and ignore the rest.
- The user would be able to choose which nodes to output to the big OffscreenCanvas as well. When the user selects a node preview to "maximize", we can then render that node to the big OffscreenCanvas, similar to the `output('F', F)` example above.
- We can create a svelte store `maximizedPreviewNode: string | null` that holds which node is currently used as an output.
  - If it is not null, we output that node to `OffscreenCanvas`.
  - If it is null, we use the node connected to the `bg.out` node.
  - If it is null and there is no node connected to `bg.out`, we will not render anything to the OffscreenCanvas.

## Previews

Because we want to use a single OffscreenCanvas for all rendering, and you can only have one GPU output in a single OffscreenCanvas, we need to use `regl.read()` (which calls `gl.readPixels()` underneath) to read the pixels for preview.

Remember that `gl.readPixels()` is slow, so this have to be heavily optimized. The goal is to make the data transfer from GPU to CPU as small as possible.

We should pass nodes that need previews to a "resize" render pass first. The goal is to shrinks the framebuffer output to a smaller size (e.g. `200x200`) and make it lower quality. The aim is to reduce the amount of data that needs to be transferred.

The goal is that we should be able to have 100s of previews at once without dropping FPS.

Another optimization idea is to optimize with level-of-detail and culling.

- Culling: Determine which node are currently visible in the viewport. Do not preview nodes that are not visible.
- LoD: Determine what is the canvas zoom level, and what are the node's actual sizes on the screen. Based on that, we can decide what is the proper resolution. If the node is only `50x50` visible on the screen, we render `50x50` for performance.

## Workers

In the end, we should be able to fully run this render graph in a web worker. This means that all the rendering will be done off-thread.

We need to transfer two things: the big output image, and the multiple smaller node previews.

For the big output image:

```ts
// worker thread
const bitmap = offscreenCanvas.transferToImageBitmap()
self.postMessage({type: 'output', bitmap}, [bitmap])

// main thread
rendererWorker.onmessage = (event) => {
  const {bitmap} = event.data
  previewCanvas.getContext('bitmaprenderer').transferFromImageBitmap(bitmap)
}
```

For the smaller node previews:

```ts
// worker thread
resizeFramebuffer.use(() => {
  // input texture is the high-quality output of a node in the render graph
  // render the preview node to the resize framebuffer
  resizeCommand({textures: [inputNode]})

  // read the pixels from the framebuffer
  // this should be very small as we've resized the output to 100x100 or similar
  const pixels: Uint8Array = regl.read()

  self.postMessage({type: 'preview', nodeId, buffer: pixels.buffer}, [
    pixels.buffer,
  ])
})

// main thread
rendererWorker.onmessage = async (event) => {
  const {type, nodeId, buffer} = event.data

  const imageData = new ImageData(new Uint8Array(buffer), width, height)

  const bitmap = await createImageBitmap(imageData)

  previewCanvas.getContext('bitmaprenderer').transferFromImageBitmap(bitmap)
}
```

## Implementation Notes

- Please use the `regl` library for rendering. It is already set up in `GLSLCanvasManager` and `GLContextManager`.
- Every framebuffer should live in the same WebGL context to minimize copy. This is why we only create a single `OffscreenCanvas` for the entire rendering graph.
- Each `glsl` node's shader output shall render to its own dedicated FBO with an attached texture.

## Future Note #1

- We will implement nested patches and abstractions soon, which means that in the future we may not care about image previews at all for part of the graph (as they are nested and is not visible), but we will still need the image outputs for those.
- The biggest challenge is that most nodes are not compatible with framebuffers, such as `p5` (by default) and `canvas` nodes. Some nodes like `hydra` also use their own WebGL rendering context, so we can't capture their framebuffer due to isolation.
  - We need to mark the `glsl` node as compatible with FBO. If an node is not framebuffer-compatible, we will fall back to `texture.subimage(canvas)` to copy from CPU to GPU. We try to use framebuffers when possible.
  - In the future, we will try to make more nodes compatible with framebuffers, but for now we will focus on the `glsl` node.

## Future Note #2: Supporting other video nodes

In the future, we aim to support other video nodes that can render to framebuffers.

- Hydra.js (hydra-ts)
  - Hydra uses REGL under the hood.
  - We will need to package-patch Hydra to use our shared `OffscreenCanvas` and `WebGLRenderingContext`. Right now `_initRegl` passes `canvas: this.canvas`, but we need to pass `gl` instead, so we can pass the offscreen canvas' rendering context.
  - It also needs to render to a FBO from the node graph.
- `canvas`
  - We can easily use `OffscreenCanvas` here instead.
- P5.js
  - P5.js has support for `createGraphics()` and `createFramebuffer()` which can be used for creating framebuffers.
    - `createFramebuffer` calls `gl.createFramebuffer()` under the hood.
    - We'll have to figure out how to pass this to the `glsl` node though.
  - `createFramebuffer` can only be used in webgl mode.
  - `createGraphics(width, height, WEBGL)` renders to WebGL 2.

Worst-case, we will incur a CPU-to-GPU transfer and directly feed in the texture from the CPU using `texture.subimage(canvas)`. It's really bad for performance, but it is a fallback for nodes that are not compatible with framebuffers.
