# 178. OpenCV JavaScript Runner API

## Problem

OpenCV.js needs asynchronous WebAssembly initialization. Repeating its package-specific
loader in every `js` or `worker` object is noisy and makes patches fragile.

## Behavior

- `opencv()` is a top-level async API in `js` and `worker` objects.
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

The threshold, contours, edges, color-mask, and motion presets emit normalized
`Float32Array` RGBA messages with `textureFormat: 'rgba8'`. Connect them to `float.tex`
and then a visual node such as `glsl>` or `hydra>` to view their output. This reuses the
existing message-to-video bridge without promising a generic OpenCV video-output node.

## Verification

- Calling `opencv()` twice in one realm imports the package once and both calls wait for
  readiness.
- The completion is available in `js` and `worker`, but not unrelated JavaScript objects.
- Every OpenCV preset is registered once in the OpenCV preset pack.
