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

To enable visual chaining, we must first create a separate 'video_in' inlet and 'video_out' outlet for the 4 video objects above. This outlet will allow the object to be used as a video source for other objects.

To clarify, these video inlets and outlets are only applicable to the video objects. They are not applicable to regular objects like `js`.

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

## Clarifying Questions from Claude Code

1. Video Handle Placement: The spec mentions video inlet/outlet should be "the last slot". Should this be:

   - A separate handle positioned differently (e.g., side handles)?
   - Or additional handles below the existing message handles?

Answer: the inlets and outlets should always be on the top and bottom of the object, respectively. There can be multiple inlets and outlets, so you can align them together horizontally with a little gap between them.

2. Multiple Video Inputs: For GLSL nodes with 4 channels (iChannel0-3), should there be:

   - 4 separate video inlet handles?
   - Or 1 inlet that can accept multiple connections?

Answer: let's do 4 separate video inlets, so it is always clear which channel goes into which inlet. Again, they will consume it as a `sampler2D iChannel0;` in the GLSL code.

3. Canvas Streaming: How should canvas data flow between nodes?

   - Direct HTMLCanvasElement reference sharing?
   - Copy canvas data each frame?
   - Use MediaStream/VideoTexture for efficiency?

Answer: We can use the `captureStream()` method on HTMLCanvasElement to create a `MediaStream` which includes a `CanvasCaptureMediaStreamTrack` containing a real-time video capture of the canvas's contents:

```js
const stream = canvas.captureStream()
stream.getTracks()
```

Let's find out how we can capture and use this MediaStream in four of the existing video objects: P5.js, Hydra, HTML5 canvas, and GLSL.

4. Update Frequency: Should video sources update:

   - Every animation frame (60fps)?
   - On-demand when source changes?
   - Configurable frame rate?

Answer: Let's stick to the default animation frame rate (60fps) for consistency. We will allow setting frame rates later in the future.

5. fromCanvas() Return Values: The spec shows different usage patterns:

   - Hydra: fromCanvas(s0) - modifies existing source
   - P5.js: const canvas = fromCanvas() - returns something to pass to createVideo()

What should fromCanvas() actually return in P5.js? A canvas element, media element, or
something else?

Answer: I think it should return a `p5.MediaElement` in case of P5.js, so the P5 sketch always has a dynamic video source reference. If one wants to capture a still frame from the stream, they can still do that.

6. Multiple Video Sources: If a node has multiple video inputs connected:

- How does fromCanvas() know which one to return? Answer: it should only return the first connected video source.
- Should it be fromCanvas(0), fromCanvas('channelName'), etc.? Answer: it should not have any parameter usually, the exception is Hydra as you need to input in the source object (s0) for hydra to initialize the source.

7. Handle Styling: How should video handles look different from message handles?

   - Different colors?
   - Different shapes?
   - Different icons/labels?

Answer: let's keep it super minimal and just use a different color for now. Eventually we want to add a tooltip on hover as well.

8. Connection Validation: Should the system:

   - Prevent connecting video outlets to message inlets?
   - Allow mixed connections?
   - Show warnings for incompatible connections?

Answer: yes, we eventually should prevent this, but let's start with allowing mixed connections for now.
