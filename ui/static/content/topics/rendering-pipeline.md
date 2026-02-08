# Rendering Pipeline

> **Tip**: Use objects that run on the rendering pipeline (`hydra`, `glsl`, `swgl`, `canvas`, `textmode`, `three`, `img`) to reduce lag.

Behind the scenes, [video chaining](/docs/video-chaining) constructs a rendering pipeline using [framebuffer objects](https://www.khronos.org/opengl/wiki/Framebuffer_Object) (FBOs). This lets visual objects copy data to one another at the framebuffer level, with no CPU-GPU transfers needed.

The pipeline uses Web Workers, WebGL2, [Regl](https://github.com/regl-project/regl), and OffscreenCanvas.

## How It Works

The pipeline creates a shader graph that:
- Streams low-resolution preview to the preview panel
- Renders full-resolution in frame buffer objects

This is much more efficient than rendering on the main thread or using HTML5 canvases.

## Objects on the Rendering Pipeline (Web Worker)

These objects run entirely on the web worker thread and are very performant when chaining:

- `hydra`
- `glsl`
- `swgl`
- `canvas`
- `textmode`
- `three`
- `img`

No CPU-to-GPU pixel copy is needed.

## Objects on the Main Thread

These objects run on the main thread:

- `p5`
- `canvas.dom`
- `textmode.dom`
- `three.dom`
- `bchrn`

When connected to video outlets:
- Each frame creates an image bitmap on the main thread
- Bitmap is transferred to the web worker for rendering
- This causes FPS drops (10-20 FPS when chaining to `bg.out`)

**Performance tip**: If you don't connect the video outlet to another object, no bitmap copy occurs and overhead is minimal.

Use main thread objects only when you need:
- Instant FFT reactivity
- Mouse interactivity
- DOM access

## Performance Comparison

| Action | Result |
|--------|--------|
| `canvas` → `bg.out` | No FPS drop |
| `canvas.dom` → `bg.out` | FPS drops to 10-20 |

Use `Ctrl/Cmd + K > Toggle FPS Monitor` to verify.

## Webcam and Video Performance

On Chromium browsers (Chrome, Edge), optimized pipelines are used:

- `webcam` uses [MediaStreamTrackProcessor](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor)
- `video` uses [MediaBunny](https://mediabunny.dev) with [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)

The HTMLVideoElement fallback uses [requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback).

### Debug Commands

- `Ctrl/Cmd + K > Toggle Video Stats Overlay` - show pipeline, FPS, dropped frames, resolution, codec
- `Ctrl/Cmd + K > Toggle MediaBunny` - switch between MediaBunny and HTMLVideoElement

Note: MediaBunny/MediaStreamTrackProcessor is faster on Chromium but slower on Firefox/Safari.

## See Also

- [Video Chaining](/docs/video-chaining) - Connect visual objects
- [Audio Reactivity](/docs/audio-reactivity) - FFT analysis
- [canvas](/docs/objects/canvas) vs [canvas.dom](/docs/objects/canvas.dom) - Performance differences
