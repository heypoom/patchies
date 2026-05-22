# 100. Hydra Datamosh

## Goal

Add a native `datamosh()` helper to the `hydra` object so sketches can route a
Hydra source through a lightweight WebCodecs feedback effect without importing
the DOM-dependent `hydra-datamosh` browser extension.

## API

Hydra user code can call:

```javascript
const mosh = datamosh(s0, { speed: 2 })
src(mosh).out()
```

`datamosh(source, params)` returns a Hydra `Source` object. The returned source
is cached per input source so repeated calls during one code run reuse the same
encoder/decoder pipeline.

Supported params:

- `speed?: number` - how many times to decode non-key frames, default `2`
- `keyFrame?: boolean` - request a key frame on the next encoded frame
- `fps?: number` - encoding frame rate cap, default `60`; capped by the global
  render FPS cap when it is not unlimited
- `bitrate?: number` - VP8 bitrate, default `1_000_000`
- `scale?: number` - encode/readback scale from `0.05` to `1`, default `1`
- `width?: number` / `height?: number` - fixed encode/readback size; setting
  one preserves source aspect ratio, setting both uses the requested size capped
  to the source dimensions

## Runtime Design

Patchies Hydra runs inside the render worker, so the implementation must not use
`window`, `document`, DOM canvases, or the global browser Hydra constructor.
Instead, it uses worker-native primitives:

- read the input Hydra source texture through the render worker WebGL context,
  flipping Y in the GPU copy shader so the CPU path does not need a scratch
  canvas flip
- use `PixelReadbackService` PBOs for async readback: one tick initiates the
  read, a later tick harvests it with `clientWaitSync(..., 0, 0)` and encodes it
  without blocking the render loop
- scale or resize the readback before the PBO read so readback, canvas upload,
  and WebCodecs encode costs drop with pixel count
- cap datamosh encoding FPS by the renderer's global FPS cap, so a 30 FPS render
  cap prevents datamosh from encoding at 60 FPS even when params request it
- build a `VideoFrame` from an `OffscreenCanvas`
- encode with `VideoEncoder`
- decode with `VideoDecoder`
- draw decoded frames into an `OffscreenCanvas`
- expose that canvas through a normal Hydra `Source`; the render loop advances
  datamosh pipelines before Hydra output shaders draw, so texture sampling does
  not run nested WebGL commands during uniform binding
- reconfigure the WebCodecs encoder when the captured source dimensions change,
  including the common case where a video inlet is connected after the Hydra
  code already started running
- lazy-load and create the datamosh runtime only when Hydra code uses
  `datamosh(...)`, so normal Hydra sketches do not pay WebCodecs setup or
  per-pipeline tick overhead

If WebCodecs is unavailable or VP8 is unsupported, `datamosh()` should return
the original input source and log a warning once for that pipeline.

## Non-Goals

- Do not support the remote `https://emptyfla.sh/hydra-datamosh/datamosh.js`
  module as-is.
- Do not create a second browser Hydra instance.
- Do not add a new object type.
