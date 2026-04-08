# 116. WebGPU ↔ Render Pipeline Bridge

## Problem

The `wgpu.compute` node is powerful but isolated. Its outputs go through CPU: GPU buffer → TypedArray → message → re-upload as WebGL texture. This round-trip kills performance for visual use cases — particle systems, fluid sims, anything that produces pixels or vertex data.

WebGPU and WebGL2 can't share GPU resources directly (API limitation). But there are practical bridges that avoid the full CPU round-trip.

## Solution

Two bridges, in order of priority:

### Bridge 1: WebGPU Render Pass → ImageBitmap → FBO Pipeline

Add a `wgpu.render` node type (or mode on the existing compute node) that renders compute results using a WebGPU render pass, then transfers the result as an ImageBitmap into the existing FBO pipeline.

**How it works**:

```
wgpu.compute                    wgpu.render                     FBO Pipeline
┌──────────┐                   ┌──────────────┐                ┌───────────┐
│ Compute   │ ──storage──►     │ Render pass  │                │           │
│ shader    │   buffer         │ (fullscreen  │ ──ImageBitmap─►│ WebGL     │
│           │                  │  quad or      │                │ texture   │
└──────────┘                   │  point cloud) │                └───────────┘
                               └──────────────┘
```

1. Compute shader writes to a storage buffer or storage texture
2. Render pass draws the result to a WebGPU canvas (fullscreen quad for textures, point cloud for particles)
3. `transferToImageBitmap()` on the WebGPU canvas
4. ImageBitmap sent to render worker via `setBitmap()` — same path as `p5`, `three.dom`, `webcam` today
5. Render worker uploads to WebGL texture via `VideoTextureManager`

**This already has a working pattern**: `three.dom` and `p5` nodes render to their own canvas and send ImageBitmaps to the FBO pipeline. The wgpu.render node would do the same thing, just with WebGPU.

**Performance**: One GPU→GPU copy (WebGPU canvas → ImageBitmap → WebGL texture). No CPU pixel readback. The ImageBitmap transfer is zero-copy between threads.

**Implementation**:

The WebGPU worker already owns a GPU device. Add:

```typescript
// In webgpuComputeWorker.ts or a new webgpuRenderWorker.ts
const canvas = new OffscreenCanvas(width, height);
const gpuContext = canvas.getContext('webgpu');
gpuContext.configure({ device, format: 'rgba8unorm', ... });

// After compute dispatch:
const commandEncoder = device.createCommandEncoder();
// ... render pass drawing compute results ...
device.queue.submit([commandEncoder.finish()]);

const bitmap = canvas.transferToImageBitmap();
self.postMessage({ type: 'previewFrame', bitmap }, [bitmap]);
```

The main thread / render worker receives the bitmap through the existing `setBitmap` path.

**Node design options**:

- **Option A**: New `wgpu.render` node type that pairs with `wgpu.compute`. Compute outputs a buffer reference (via message), render node reads it and draws.
- **Option B**: Add a `renderMode` to the existing `wgpu.compute` node. When enabled, the compute node also runs a render pass and outputs video. Simpler UX — one node does both.
- **Recommended**: Option B for simple cases (compute + render in one node), Option A for complex multi-pass pipelines.

### Bridge 2: SharedArrayBuffer Fast Path

For cases where ImageBitmap isn't suitable (non-visual data, custom layouts):

1. Compute shader writes to a mappable buffer
2. Worker reads buffer into a SharedArrayBuffer
3. Render worker reads from the same SharedArrayBuffer, uploads to GL texture or buffer
4. No main thread involvement

**Requirements**: `SharedArrayBuffer` (needs COOP/COEP headers, which Patchies may already set for other features). Cross-origin isolation.

**When to use**: Large data transfers where ImageBitmap's RGBA8 format is limiting (float data, non-image buffers). This pairs with spec 112 (float FBOs) — compute produces float data, render worker uploads to rgba32f texture.

**Implementation**: Add a `SharedBufferPool` that pre-allocates SABs. Compute worker writes, render worker reads, fence via Atomics.

### Bridge 3: Future — Direct Interop

WebGPU-WebGL interop is a proposed browser feature (not shipped). When available:

- `importExternalTexture()` or shared texture handles
- Zero-copy texture sharing between WebGPU and WebGL contexts
- No worker communication needed

Not actionable today, but the architecture should not preclude it.

## What This Enables

- **GPU particles**: Compute updates millions of positions → render draws point cloud → FBO pipeline composites with other nodes
- **Fluid sim visualization**: Compute runs Navier-Stokes → render draws velocity field as colors → downstream GLSL node post-processes
- **Neural rendering**: Compute runs inference → render displays result → chain with other effects
- **Real-time SDF**: Compute evaluates distance field → render ray-marches → output to pipeline

## Node Schema

For Option B (compute + render in one node):

```typescript
// Extend existing wgpu.compute schema
{
  type: 'wgpu.compute',
  data: {
    code: string,           // existing
    renderEnabled: boolean,  // new — enables video output
    renderCode?: string,     // new — WGSL render shader (vertex + fragment)
    renderMode: 'fullscreen' | 'points' | 'custom',  // new
  },
  // existing message inlets/outlets
  // new: video outlet when renderEnabled
}
```

For Option A (separate render node):

```typescript
{
  type: 'wgpu.render',
  data: {
    code: string,    // WGSL vertex + fragment shader
    renderMode: 'fullscreen' | 'points' | 'custom',
  },
  // message inlet (receives buffer references from compute node)
  // video outlet (ImageBitmap → FBO pipeline)
}
```

## Dependencies

- Bridge 1 uses existing ImageBitmap path (no deps)
- Bridge 2 requires SharedArrayBuffer / cross-origin isolation
- Float texture output benefits from spec 112 (float FBOs)
- Visual output enters FBO pipeline and benefits from specs 105, 107
