# Rendering Pipeline

> **Tip**: Use objects that run on the rendering pipeline (`hydra`, `glsl`, `swgl`, `canvas`, `textmode`, `three`, `img`) to reduce lag.

When you use [video chaining](/docs/video-chaining), Patchies creates a rendering pipeline with [framebuffer objects](https://www.khronos.org/opengl/wiki/Framebuffer_Object) (FBOs). Visual objects pass data between FBOs without CPU-to-GPU transfers.

The pipeline uses Web Workers, WebGL2, [Regl](https://github.com/regl-project/regl), and OffscreenCanvas.

## How It Works

The pipeline creates a shader graph:

- It sends a low-resolution preview to the preview panel.
- It renders the full-resolution output in framebuffer objects.

This reduces the cost of main-thread rendering and HTML canvas transfers.

## Objects on the Rendering Pipeline (Web Worker)

These objects run in a web worker and pass data through the GPU:

- `hydra`
- `glsl`
- `swgl`
- `canvas`
- `textmode`
- `three`
- `img`

They do not need a CPU-to-GPU pixel copy.

## Objects on the Main Thread

These objects run on the main thread:

- `p5`
- `canvas.dom`
- `textmode.dom`
- `three.dom`
- `bchrn`

When you connect one of these objects to a video outlet:

1. The object creates an image bitmap on the main thread for each frame.
2. Patchies transfers the bitmap to the web worker.
3. The transfer can reduce the frame rate to 10–20 FPS when you chain it to `bg.out`.

> **Tip**: If you do not connect the video outlet to another object, Patchies does not copy a bitmap. The overhead stays small.

Use a main-thread object only when you need:

- Immediate FFT reactivity
- Mouse input
- DOM access

## Performance Comparison

| Action | Result |
| ------ | ------ |
| `canvas` → `bg.out` | No FPS drop |
| `canvas.dom` → `bg.out` | FPS drops to 10-20 |

Use `Ctrl/Cmd + K > Toggle FPS Monitor` to check the frame rate.

## Webcam and Video Performance

Chromium browsers, such as Chrome and Edge, use optimized pipelines:

- `webcam` uses [MediaStreamTrackProcessor](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor)
- `video` uses [MediaBunny](https://mediabunny.dev) with [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)

The HTMLVideoElement fallback uses [requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

### Debug Commands

- `Ctrl/Cmd + K > Toggle Video Stats Overlay` — Shows the pipeline, frame rate, dropped frames, resolution, and codec.
- `Ctrl/Cmd + K > Toggle MediaBunny` — Switches between MediaBunny and HTMLVideoElement.

> **Note**: MediaBunny and MediaStreamTrackProcessor run faster in Chromium. They can run slower in Firefox and Safari.

## See Also

- [Video Chaining](/docs/video-chaining) — Connect visual objects.
- [Audio Reactivity](/docs/audio-reactivity) — Use FFT analysis.
- [canvas](/docs/objects/canvas) and [canvas.dom](/docs/objects/canvas.dom) — Compare their performance.
