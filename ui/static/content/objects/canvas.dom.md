The `canvas.dom` object creates a JavaScript canvas that runs on the main thread, giving you access to DOM APIs, mouse input, and keyboard events.

![Canvas.dom widgets](/content/images/patchies-canvas-dom-widgets.png)

> ✨ [Try this patch](/?demo=interactive-widget-playground) with interactive canvas.dom widgets!

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

## Focused Interactive View

Open the node overflow menu and choose **Expand** to focus the live canvas.
Your canvas keeps receiving mouse, touch, and keyboard input while Patchies
hides the rest of the editor. The view preserves the canvas aspect ratio and
fits it inside the screen, leaving black borders when needed.

Use **Exit surface** or `Shift+Esc` to return to the patch.

## Resizable Widgets

Build a widget that fills its Patchies node instead of choosing a fixed canvas size:

```javascript
setFluidSize();

function draw() {
  ctx.fillStyle = '#18181b';
  ctx.fillRect(0, 0, width, height);
}

onCanvasResize(draw);
draw();
```

The node's resize handles update `width`, `height`, the canvas bitmap, and mouse coordinates.
Use `onCanvasResize()` when your widget only draws on demand. An animation loop that reads
`width` and `height` redraws at the new size automatically.

In a fluid widget, `width` and `height` act like live numbers for arithmetic and common
formatting methods such as `toFixed()`. Do not use `typeof`, `Number.isFinite()`, or JSON
serialization on them; copy them first with `const currentWidth = Number(width)` when needed.

Set a starting size and choose how people can resize the widget:

```javascript
setFluidSize({
  initialSize: { width: 800, height: 600 },
  resize: 'horizontal'
});
```

Open the node overflow menu to enable or disable resizing. Pass
`setFluidSize({ showResizer: false })` to hide the handles initially; the menu remains available.
You can also limit a controller to one resize axis, or preserve its shape:

```javascript
setFluidSize({ resize: 'horizontal' }); // e.g. a fader
setFluidSize({ resize: 'vertical' });   // e.g. a meter
setFluidSize({ keepAspectRatio: true }); // e.g. a square pad grid
setFluidSize({ initialSize: { width: 800, height: 600 } }); // starting size
```

`resize` defaults to `'both'`. `keepAspectRatio` uses both dimensions to preserve the
node's initial ratio. `initialSize` uses logical canvas pixels (the same coordinate space as
`width` and `height`) and applies only before a user has set an explicit node size.
In fluid mode, `setCanvasSize()` is ignored and reports a one-time console warning.

## Special Functions

All [Patchies JavaScript Runner](/docs/javascript-runner) functions are available, plus:

- `noOutput()` - hide video output port
- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see [Canvas Interaction](/docs/canvas-interaction)
- `noBorder()` - hides Patchies' border and selected glow until the call is removed and the node runs again
- `fft()` - audio analysis with low latency

## Presets

- `particle.canvas` - particle system reacting to mouse
- `XY Pad` - X-Y coordinate pad
- `RGB Picker` - color picker widget that outputs normalized `[r, g, b]`
- `HSL Picker` - color picker widget that outputs normalized `[h, s, l]`
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
