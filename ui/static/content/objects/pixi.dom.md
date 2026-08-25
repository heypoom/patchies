The `pixi.dom` object creates interactive [PixiJS 8](https://pixijs.com/8.x) graphics on a main-thread canvas. Use it when your scene needs native pointer events.

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

onCanvasResize(({ width, height }) => {
  badge.position.set(width / 2, height / 2);
});
```

`setFluidSize()` supports `showResizer`, `resize`, and `keepAspectRatio`, with
the same behavior as [canvas.dom](/docs/objects/canvas.dom#resizable-widgets).
While fluid mode is active, `setCanvasSize()` is ignored.

## See Also

- [pixi](/docs/objects/pixi) — worker-side PixiJS
- [canvas.dom](/docs/objects/canvas.dom) — interactive Canvas API graphics
