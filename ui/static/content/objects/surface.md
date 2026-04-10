The `surface` object creates a fullscreen transparent canvas
overlay for capturing pointer and touch events.

Unlike `canvas.dom`, the surface is designed for live performance.
It hides the node editor and takes over the entire screen
while keeping the video pipeline running underneath.

This lets you keep mouse-interactive visuals on the surface
while GPU-intensive shaders run in the background without interruption.

## States

| State | Description |
|-------|-------------|
| **Preview** | Default. Small canvas preview in the node editor, interactive. |
| **Fullscreen** | Full-screen overlay. Node editor hidden, video pipeline visible beneath. |

Use **Go Live** in the node menu (or send `{ type: 'expand' }`) to enter
fullscreen. Press **Shift+Esc** or send `{ type: 'collapse' }` to exit.

## Getting Started

```javascript
onPointer(({ x, y, down }) => {
  if (!down) return;

  ctx.beginPath();
  ctx.arc(x * width, y * height, 20, 0, Math.PI * 2);
  ctx.fill();
});
```

## Coordinate System

All coordinates are normalized to **0–1** relative to the canvas size.
Multiply by `width` / `height` to get pixel coordinates:

```javascript
const px = x * width;
const py = y * height;
```

## Pointer Events

`onPointer(callback)` fires on every pointer move and click:

```javascript
onPointer(({ x, y, buttons, down, type }) => {
  // type: 'move' | 'down' | 'up'
  // buttons: bitmask (1 = left, 2 = right, 4 = middle)
});
```

Pointer events are also sent to the **pointer outlet** as messages.

## Touch Events

`onTouch(callback)` fires with all active touch points:

```javascript
onTouch((touches) => {
  for (const { id, x, y, pressure } of touches) {
    ctx.beginPath();
    ctx.arc(x * width, y * height, 30 * (pressure || 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
});
```

## Draw Modes

By default, we draw the canvas on every frame.
To optimize performance, switch to `'interact'` (draw only on pointer activity)
or `'manual'` (draw only when `redraw()` is called):

```javascript
setDrawMode('always');   // Draw every frame (default)
setDrawMode('interact'); // Draw only on pointer activity
setDrawMode('manual');   // Draw only when redraw() is called
```

## Activation API

You can programmatically enter or exit fullscreen surface mode thru JavaScript:

```javascript
activate();    // Enter fullscreen surface mode
deactivate();  // Exit fullscreen surface mode
```

Or, send messages to the inlet:

```ts
{ type: 'expand' }    → enter fullscreen
{ type: 'collapse' }  → exit fullscreen
```

## Window Resize

The canvas automatically resizes to the window. `width` and `height` always
reflect the current window dimensions.

## JavaScript Functions

All [Patchies JavaScript Runner](/docs/javascript-runner) functions are available,
plus:

- `onPointer(cb)` — register pointer event callback
- `onTouch(cb)` — register touch event callback
- `onKeyDown(cb)` / `onKeyUp(cb)` — keyboard callbacks
- `setDrawMode('always'|'interact'|'manual')` — control render loop
- `redraw()` — manually trigger a draw (manual mode)
- `activate()` / `deactivate()` — enter/exit fullscreen
- `noOutput()` — hide video output port

## See Also

- [canvas.dom](/docs/objects/canvas.dom) - main thread canvas without fullscreen
- [canvas](/docs/objects/canvas) - offscreen canvas (faster for video chaining)
- [p5](/docs/objects/p5) - P5.js creative coding environment
