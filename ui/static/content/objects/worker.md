Runs JavaScript in a dedicated Web Worker thread, allowing CPU-intensive
computations without blocking the main thread.

Everything in the [Patchies JavaScript Runner](/docs/javascript-runner) is
supported, except `requestAnimationFrame()` (uses 60fps setInterval as fallback)
and import shared code from Patch JavaScript files.

## Special Methods

- **`setRunOnMount(true)`** - run the code automatically when created
- **`flash()`** - briefly flash the node's border for visual feedback

Patch JavaScript files can be imported in
`worker` nodes.

## OpenCV

Use `await opencv()` to lazy-load OpenCV.js and wait until its WebAssembly runtime
is ready. The module is cached for the lifetime of this worker. `worker` is the
right place for CPU-intensive image processing.

```js
const cv = await opencv();
const source = cv.matFromImageData(image);
const gray = new cv.Mat();
const edges = new cv.Mat();

cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
cv.Canny(gray, edges, 80, 160);

source.delete();
gray.delete();
edges.delete();
```

Always call `.delete()` on OpenCV allocations. The OpenCV presets show direct video
output examples.

## Video Frame Capture

Worker nodes can capture video frames from connected visual nodes:

`setVideoCount(inletCount, outletCount?)`

Configure video ports. Worker video output supports at most one RGBA frame stream;
calling `setVideoCount()` with more than one output throws an error.

```js
// Create one input and one output for a video-processing worker
setVideoCount(1, 1);
```

`onVideoFrame(callback, config?)`

Register a callback that receives frames each render cycle.

```js
onVideoFrame((frames, timestamp) => {
  // frames is an array of raw RGBA frames (or null if source unavailable)
  const [frame] = frames;
  if (frame) {
    console.log(frame.width, frame.height, frame.data);
  }
}, { fps: 15 });

// Use a smaller image for faster CPU processing
onVideoFrame(callback, { resolution: [640, 480], fps: 15 });
```

`getVideoFrames(config?)`

One-shot async capture, returns a Promise.

```js
const frames = await getVideoFrames();
const [frame] = frames;

// Request ImageBitmap frames explicitly. Close each one when finished.
const bitmaps = await getVideoFrames({ format: 'bitmap' });
bitmaps.forEach((frame) => frame?.close());
```

Both methods accept an optional config object with:

- `resolution?: [width, height]` - Capture at a specific resolution
- `format?: 'raw' | 'bitmap'` - Raw RGBA `{ data, width, height }` is the default. Use bitmap for Canvas APIs.
- `fps?: number` - Maximum capture rate for `onVideoFrame()` (up to 30). Defaults to 30.

Raw frames skip the canvas and ImageBitmap conversion, which makes them the best choice for OpenCV and other CPU image processing. Raw frame buffers are transferred to the worker; do not retain them after your callback returns.

`setVideoFrame(frame)`

Upload processed raw RGBA pixels to video outlet 0. The pixel buffer is transferred to
the renderer, so do not reuse it after this call.

```js
setVideoCount(1, 1)

onVideoFrame(([frame]) => {
  if (!frame) return

  // Process or replace frame.data before publishing it.
  setVideoFrame({
    data: new Uint8ClampedArray(frame.data),
    width: frame.width,
    height: frame.height
  })
}, { fps: 15 })
```

For OpenCV, copy the result from the OpenCV WebAssembly heap before calling
`setVideoFrame()`:

```js
setVideoFrame({
  data: new Uint8ClampedArray(output.data),
  width: frame.width,
  height: frame.height
})
```

## SuperSonic OscChannel

Worker nodes can send OSC messages directly to scsynth via
`getSuperSonicChannel()`, bypassing the main thread for
low-latency sequencing.

```js
const { channel, osc } = await getSuperSonicChannel()

channel.send(osc.encodeMessage('/s_new',
  ['sonic-pi-beep', -1, 0, 0, 'note', 64, 'amp', 0.5]))
```

See [sonic~](/docs/objects/sonic~) for full examples including
a worker-based sequencer.

## See Also

- [js](/docs/objects/js) - JavaScript in the main thread
- [float.tex](/docs/objects/float.tex) - Float data textures, better for control and simulation data
- [sonic~](/docs/objects/sonic~) - SuperSonic synthesis engine
- [JavaScript Runner](/docs/javascript-runner) - full API reference
