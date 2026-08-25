The `pixi` object creates 2D graphics with [PixiJS v8.x](https://pixijs.com/8.x/guides/getting-started/intro). It runs in Patchies' web-worker render pipeline, so its output chains efficiently to other visual objects.

## Getting Started

`PIXI` is the PixiJS namespace, `stage` is the root container, and `renderer` is the Pixi WebGL renderer. Define `draw(time)` to update the scene each frame:

```javascript
const { Graphics } = PIXI

const circle = new Graphics()
  .circle(0, 0, 80)
  .fill(0x66ccff);

circle.position.set(width / 2, height / 2);
stage.addChild(circle);

function draw(time) {
  circle.rotation = time;
}
```

The Patchies renderer schedules frames. Do not create a second animation loop or call `renderer.render()` yourself.

## Extensions

`pixi` includes graphics support. Call and await `loadExtensions()` before using an optional extension's APIs:

```javascript
await loadExtensions('filters')

const { Graphics, BlurFilter } = PIXI

const circle = new Graphics()
  .circle(width / 2, height / 2, 100)
  .fill(0x66ccff)

circle.filters = [new BlurFilter({ strength: 8 })]
stage.addChild(circle)
```

Pass several names together to rebuild the shared worker renderer once, or use `'all'` to enable every worker-safe extension:

```javascript
await loadExtensions('advanced-blend-modes', 'text-bitmap', 'prepare')
// await loadExtensions('all')
```

Available names are `advanced-blend-modes`, `app`, `basis`, `dds`, `filters`,
`gif`, `graphics`, `ktx`, `ktx2`, `math-extras`, `mesh`,
`particle-container`, `prepare`, `sprite-nine-slice`, `sprite-tiling`, `text`,
`text-bitmap`, and `unsafe-eval`.

`accessibility`, `dom`, `events`, and `text-html` require browser DOM APIs and
cannot run in the render worker. Use [pixi.dom](/docs/objects/pixi.dom) for
native pointer, keyboard, HTML text, and DOM behavior.

## How It Works

`pixi` shares Patchies' worker WebGL context and copies its rendered stage into the node's video output. This keeps the result in the render graph for downstream effects, previews, feedback, and `bg.out`.

Use [pixi.dom](/docs/objects/pixi.dom) when your scene needs native pointer, keyboard, or DOM access.

## See Also

- [pixi.dom](/docs/objects/pixi.dom) — main-thread interactive PixiJS
- [three](/docs/objects/three) — worker 3D graphics
- [canvas](/docs/objects/canvas) — worker Canvas API graphics
