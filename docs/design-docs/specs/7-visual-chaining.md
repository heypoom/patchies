# 7. Visual Chaining

We should allow blocks to become video sources for another video blocks, as well as being the consumer of another video blocks:

- `p5.canvas`
- `hydra`
- `js.canvas`
- `glsl.canvas`

The idea is that if a video block is wired to another video block, we should allow exposing the connected video block as a source.

- In hydra, you can use HTMLCanvas as a source. That means you can use P5.js canvases as sources.
- In P5.js, we have to figure out how to capture the canvas from hydra as a `p5.MediaElement` so that it can be used in the P5.js sketch.
- In JavaScript canvas, you can use `ctx.drawImage(source, 0, 0)` to draw the source onto the current canvas.
- In GLSL, you can use `sampler2D` to sample from another canvas texture.
  - We want to be compliant with ShaderToy, so we can use `iChannel0`, `iChannel1`, `iChannel2` and `iChannel3` to refer to the sources.
  - Once the inlet/outlet system is implemented, we can create named inlets for each channel, which can be used with `sampler2D iChannel0;` in the GLSL code.

## How to opt-in to chaining

Use P5.js sketch as source for hydra:

```js
initCanvasSource(s0)
s0.out()
```

Use hydra as source for P5.js:

```js
const hydra = canvasSource()
const video = createVideo(hydra)
```
