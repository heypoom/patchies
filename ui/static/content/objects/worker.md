Runs JavaScript in a dedicated Web Worker thread, allowing CPU-intensive
computations without blocking the main thread.

Everything in the [Patchies JavaScript Runner](/docs/javascript-runner) is
supported, except `requestAnimationFrame()` (uses 60fps setInterval as fallback)
and `// @lib` declaration (libraries must be created in regular `js` nodes).

## Special Methods

- **`setRunOnMount(true)`** - run the code automatically when created
- **`flash()`** - briefly flash the node's border for visual feedback

Libraries created with `// @lib` in a regular `js` node can be imported in
`worker` nodes.

## Video Frame Capture

Worker nodes can capture video frames from connected visual nodes:

### `setVideoCount(inletCount)`

Configure the number of video inlets for receiving frames.

```js
// Create 2 video inlets to receive from 2 sources
setVideoCount(2);
```

### `onVideoFrame(callback, config?)`

Register a callback that receives frames each render cycle.

```js
onVideoFrame((frames, timestamp) => {
  // frames is an array of ImageBitmap (or null if source unavailable)
  const [frame] = frames;
  if (frame) {
    // Process the frame...
  }
});

// With custom resolution (default is preview size)
onVideoFrame(callback, { resolution: [640, 480] });
```

### `getVideoFrames(config?)`

One-shot async capture, returns a Promise.

```js
const frames = await getVideoFrames();
const [frame] = frames;

// With custom resolution
const frames = await getVideoFrames({ resolution: [1920, 1080] });
```

Both methods accept an optional config object with:

- `resolution?: [width, height]` - Capture at a specific resolution

## See Also

- [js](/docs/objects/js) - JavaScript in the main thread
- [JavaScript Runner](/docs/javascript-runner) - full API reference
