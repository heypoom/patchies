The `canvas.dom` object creates a JavaScript canvas that runs on the main thread, giving you access to DOM APIs, mouse input, and keyboard events.

![Canvas.dom widgets](/content/images/patchies-canvas-dom-widgets.png)

> ✨ [Try this patch](/?id=izs6hjxchit2zad&readonly=true) with interactive canvas.dom widgets!

## Comparison with canvas

| Feature | `canvas` | `canvas.dom` |
|---------|----------|--------------|
| Runs on | Web worker (offscreen) | Main thread |
| Video chaining | Fast (no copy) | Slow (CPU-to-GPU copy) |
| DOM access | No | Yes |
| Mouse access | No | Yes |
| Keyboard events | No | Yes |
| FFT latency | High | Low |

Use `canvas.dom` when you need interactivity or instant audio reactivity. Use `canvas` for pure video processing.

## Getting Started

The rendering context is exposed as `ctx`. Use standard Canvas API methods:

```javascript
ctx.fillStyle = 'blue';
ctx.fillRect(mouse.x - 25, mouse.y - 25, 50, 50);
```

## Mouse Access

The `mouse` object provides real-time mouse state:

```javascript
// mouse.x, mouse.y - cursor position
// mouse.down - true if any button pressed
// mouse.buttons - bitmask of pressed buttons

if (mouse.down) {
  ctx.fillRect(mouse.x, mouse.y, 10, 10);
}
```

## Keyboard Events

Register keyboard handlers that don't leak to the editor:

```javascript
onKeyDown((e) => {
  if (e.key === 'ArrowUp') velocity.y -= 1;
  if (e.key === 'ArrowDown') velocity.y += 1;
});

onKeyUp((e) => {
  console.log('Released:', e.key);
});
```

## Dynamic Canvas Size

Resize the canvas resolution dynamically:

```javascript
setCanvasSize(800, 600);
```

## Special Functions

All [Patchies JavaScript Runner](/docs/javascript-runner) functions are available, plus:

- `noOutput()` - hide video output port
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `fft()` - audio analysis with low latency

## Presets

- `particle.canvas` - particle system reacting to mouse
- `xy-pad.canvas` - X-Y coordinate pad
- `rgba.picker` / `hsla.picker` - color picker widgets
- `keyboard.example` - keyboard event demo
- `fft.canvas` - fast FFT visualization

## Performance Notes

- Video chaining from `canvas.dom` is slower (requires CPU-to-GPU pixel copy)
- Heavy computation can affect UI responsiveness
- For pure video processing without interactivity, use `canvas` instead

## See Also

- [canvas](/docs/objects/canvas) - offscreen canvas (faster for video chaining)
- [p5](/docs/objects/p5) - P5.js for easier creative coding
- [glsl](/docs/objects/glsl) - GPU shaders
