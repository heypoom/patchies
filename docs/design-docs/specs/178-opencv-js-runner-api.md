# 178. OpenCV JavaScript Runner API

## Problem

OpenCV.js needs asynchronous WebAssembly initialization. Repeating its package-specific
loader in every JavaScript runner object is noisy and makes patches fragile.

## Behavior

- `opencv()` is a top-level async API in `js`, `worker`, `canvas`, and `canvas.dom`
  objects.
- It lazy-loads `@techstark/opencv-js`, resolves only after `cv.Mat` is available, and
  returns the ready OpenCV module.
- The load promise is cached once per JavaScript realm. Main-thread `js` objects share
  one module; every dedicated `worker` has its own module.
- Users must free OpenCV allocations with `.delete()`.

## Presets

The **OpenCV Demos** preset pack captures the first connected video inlet with
`onVideoFrame()`. Video callbacks default to raw `{ data, width, height }` RGBA frames
and may set `resolution` and an optional maximum `fps`. `format: 'bitmap'` remains
available for Canvas APIs.

`worker` nodes can expose at most one video output with `setVideoCount(inlets, 1)` and publish
an RGBA8 frame with `setVideoFrame({ data, width, height })`. The frame buffer transfers
from the dedicated worker to the render worker through the main-thread broker, avoiding
the Float32 expansion and texture conversion required by `float.tex`. OpenCV results must
be copied out of WebAssembly memory into a transferable `Uint8ClampedArray` first.

The threshold, contours, edges, color-mask, and motion presets use this direct video
output. Connect them directly to a visual node such as `glsl>` or `hydra>`.

## Verification

- Calling `opencv()` twice in one realm imports the package once and both calls wait for
  readiness.
- The completion is available in `js`, `worker`, `canvas`, and `canvas.dom`, but not
  unrelated JavaScript objects.
- A worker can publish a transferred RGBA8 frame through video outlet 0.
- Every OpenCV preset is registered once in the OpenCV preset pack.
