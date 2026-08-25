The `pixi` object creates 2D graphics with [PixiJS 8](https://pixijs.com/8.x). It runs in Patchies' web-worker render pipeline, so its output chains efficiently to other visual objects.

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

## How It Works

`pixi` shares Patchies' worker WebGL context and copies its rendered stage into the node's video output. This keeps the result in the render graph for downstream effects, previews, feedback, and `bg.out`.

Use [pixi.dom](/docs/objects/pixi.dom) when your scene needs native pointer, keyboard, or DOM access.

## See Also

- [pixi.dom](/docs/objects/pixi.dom) — main-thread interactive PixiJS
- [three](/docs/objects/three) — worker 3D graphics
- [canvas](/docs/objects/canvas) — worker Canvas API graphics
