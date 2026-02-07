The `canvas` object creates an offscreen JavaScript canvas for graphics and animations using the [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API). It runs on a web worker for fast video chaining.

## Getting Started

The rendering context is exposed as `ctx`. Use standard Canvas API methods:

```javascript
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 100, 100);

ctx.beginPath();
ctx.arc(200, 200, 50, 0, Math.PI * 2);
ctx.fill();
```

## How It Works

Runs on the rendering pipeline using [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) on web workers.

**Pros:**
- Chains with other visual objects (`glsl`, `hydra`, etc.) without lag
- Fast 60fps animations that don't block the main thread

**Cons:**
- No DOM APIs (`document`, `window`)
- No mouse or keyboard access
- High FFT delay due to worker message passing

Need mouse, keyboard, or DOM access? Use [canvas.dom](/docs/objects/canvas.dom) instead.

## Special Functions

See the [Patchies JavaScript Runner](/docs/javascript-runner) for all available functions like `send()`, `recv()`, `setPortCount()`, `onCleanup()`, and more.

Canvas-specific functions:

- `noOutput()` - hides the video output port
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis (note: high latency in offscreen mode)

## Resources

- [MDN Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) - official docs
- [Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial) - getting started

## See Also

- [canvas.dom](/docs/objects/canvas.dom) - main thread variant with mouse/keyboard
- [p5](/docs/objects/p5) - P5.js for easier creative coding
- [glsl](/docs/objects/glsl) - GPU shaders
- [hydra](/docs/objects/hydra) - live coding visuals
