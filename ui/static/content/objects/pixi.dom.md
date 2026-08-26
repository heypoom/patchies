The `pixi.dom` object creates interactive [Pixi.js v8.x](https://pixijs.com/8.x/guides/getting-started/intro) graphics on a main-thread canvas. Use it when your scene needs native pointer events.

## Getting Started

`PIXI`, `renderer`, and `stage` are available.

Make a display object interactive with `eventMode = 'static'` or `eventMode = 'dynamic'`:

```javascript
const { Graphics } = PIXI;

const button = new Graphics()
  .roundRect(40, 40, 220, 80, 16)
  .fill(0x66ccff);

button.eventMode = 'static';
button.cursor = 'pointer';
button.on('pointertap', () => button.tint = Math.random() * 0xffffff);

stage.addChild(button);
```

## Extensions

`pixi.dom` lazily loads PixiJS when the first object is added. You can then
load any PixiJS 8 extension, including browser-only extensions, before using
its APIs:

```javascript
await loadExtensions('accessibility')

const { Graphics } = PIXI

const button = new Graphics()
  .circle(width / 2, height / 2, 80)
  .fill(0x66ccff)

button.eventMode = 'static'
button.on('pointertap', () => button.tint = Math.random() * 0xffffff)
stage.addChild(button)
```

Native Pixi pointer events are ready by default. Use `await loadExtensions('all')`
to load every optional PixiJS extension. The first call
for a new extension recreates the shared Pixi renderer while keeping every
`pixi.dom` stage and canvas in place. Group extension names in one call to do
that once.

See [pixi](/docs/objects/pixi#extensions) for the extension-name list.

## Comparison with pixi

| Feature | `pixi` | `pixi.dom` |
| -------- | ------ | ---------- |
| Runs on | Web worker | Main thread |
| Video chaining | Fast | Copies canvas into the pipeline |
| Native pointer events | No | Yes |
| DOM access | No | Yes |

Use `pixi` for render-graph performance. Use `pixi.dom` for full PixiJS interaction.

## Dynamic Canvas Size

Choose a fixed Pixi canvas resolution with `setCanvasSize()`:

```javascript
setCanvasSize(800, 600);

const { Graphics } = PIXI;

const badge = new Graphics()
  .circle(width / 2, height / 2, 100)
  .fill(0x66ccff);

stage.addChild(badge);
```

Use `setFluidSize()` when the Pixi scene should fill its Patchies node. The
resize handles update the renderer, canvas bitmap, and the live `width` and
`height` values:

```javascript
setFluidSize({ initialSize: { width: 800, height: 600 } });

const { Graphics } = PIXI;

const badge = new Graphics()
  .circle(width / 2, height / 2, 100)
  .fill(0x66ccff);

stage.addChild(badge);

function draw() {
  badge.position.set(width / 2, height / 2);
}
```

`setFluidSize()` supports `showResizer`, `resize`, and `keepAspectRatio`, with
the same behavior as [canvas.dom](/docs/objects/canvas.dom#resizable-widgets).
While fluid mode is active, `setCanvasSize()` is ignored.

Use `draw()` for scenes that need to react continuously. It reads the live
`width` and `height` values on every Pixi frame, so you can update a scene
during a resize. Use `onCanvasResize()` to update static scenes. It runs at
most once per animation frame while resizing. Patchies does not re-run your
Pixi code after a fluid resize, preserving the stage and interaction state.

## Video Output

`pixi.dom` keeps its video output disabled by default. Copying its canvas into
the video pipeline is slower than worker-side [pixi](/docs/objects/pixi), so
enable the output only when the scene feeds another video node.

Call `setVideoOutput(true)` when you want to chain the scene into another visual:

```javascript
setVideoOutput(true)

const { Graphics } = PIXI

const badge = new Graphics()
  .circle(width / 2, height / 2, 100)
  .fill(0x66ccff)

stage.addChild(badge)
```

## Special Functions

- `loadExtensions(...names)`: loads optional PixiJS extensions
- `setVideoOutput(true)`: enables the video output port, which is disabled by default
- `setCanvasSize(width, height)`: sets a fixed canvas resolution
- `setFluidSize(options?)`: makes the canvas follow the node size
- `onCanvasResize(callback)`: runs a callback after the canvas is resized
- `noBorder()`: hides Patchies' border and selected glow until the call is removed and the node runs again

## See Also

- [pixi](/docs/objects/pixi) — worker-side Pixi.js
- [canvas.dom](/docs/objects/canvas.dom) — interactive HTML5 Canvas
