# 7. Visual Chaining

We should allow objects that utilizes HTML5 canvases to become video sources for another video objects, as well as consume other video objects as input:

- `p5.canvas`
- `hydra`
- `js.canvas`
- `glsl.canvas`

The idea is that if a video object is wired to another video object using a video outlet, we should allow exposing the connected video object as a source.

- In hydra, you can use HTMLCanvas as a source. That means you can use P5.js canvases as sources.
- In P5.js, we have to figure out how to capture the canvas from hydra as a `p5.MediaElement` so that it can be used in the P5.js sketch.
- In JavaScript canvas, you can use `ctx.drawImage(source, 0, 0)` to draw the source onto the current canvas.
- In GLSL, you can use `sampler2D` to sample from another canvas texture.
  - We want to be compliant with ShaderToy, so we can use `iChannel0`, `iChannel1`, `iChannel2` and `iChannel3` to refer to the sources.
  - This means that GLSL should have four separate video source inlets. Which would be 5 inlets now in total, including the regular message inlet.
  - Once the inlet/outlet system is implemented, we can create named inlets for each channel, which can be used with `sampler2D iChannel0;` in the GLSL code.

## How to opt-in to chaining

To enable visual chaining, we must first create a separate 'video_in' inlet and 'video_out' outlet for the four objects above. This outlet will allow the object to be used as a video source for other objects.

The video outlet should not take regular messages. It is purely used as a marker that the object will be used as a video source, and to construct a graph of video sources.

Let's add a `fromCanvas` method to each of the objects. It should conform to the format of the object. For example, `fromCanvas(s0)` in Hydra, and `fromCanvas() -> p5.MediaElement` in P5.js.

From a user's perspective, here is how to consume the inlet video source in Hydra.js

```js
fromCanvas(s0)
s0.out()
```

...and how to consume the inlet video source in P5.js

```js
const canvas = fromCanvas()
const video = createVideo(canvas)
```

## QoL Improvements

- We should add a hover tooltip to the outlet and inlet to indicate that they are video sources.
- We should differentiate the video inlet outlet from the regular message inlet/outlet visually.
- The video inlet/outlet should be the last slot in the object.
