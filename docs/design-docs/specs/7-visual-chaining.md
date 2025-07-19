# 7. Visual Chaining

We should allow blocks to become video sources for another video blocks, as well as being the consumer of another video blocks:

- `p5.canvas`
- `hydra`

The idea is that if a video block is wired to another video block, we should allow exposing the connected video block as a source.

- In hydra, you can use HTMLCanvas as a source. That means you can use P5.js canvases as sources.
- In P5.js, we have to figure out how to capture the canvas from hydra as a `p5.MediaElement` so that it can be used in the P5.js sketch.

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
