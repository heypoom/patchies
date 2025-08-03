# 19. Refactor the video nodes to share the same base component

Right now, there is a lot of duplication in the UI code for these video nodes:

- `p5`
- `glsl`
- `hydra`
- `swgl`
- `ai.img`
- `canvas`
- `bchrn`

You can notice that they all share these UI elements:

- The preview window
  - This usually renders a single canvas, except for `P5.js` which may render other DOM elements.
- A code editor
- Floating buttons
  - Edit Code
  - Pause (only for `glsl`, `hydra` and `swgl`)

Let's create a base `ObjectPreviewLayout`. For example:

```svelte
<ObjectPreviewLayout
  title="swgl"
  // for when the code has been ran (e.g. thru the play button)
  onrun={onRun}
  // for when the playback is toggled (e.g. pause/play)
  on-playback-toggle={onPlaybackToggle}
  // should always be false for non-pauseable nodes
  paused={paused}
>
  <slot name="top-handle"></slot>
  <slot name="preview">
    <canvas></canvas>
  </slot>
  <slot name="code-editor">
    <CodeEditor value={code} language="glsl" ... />
  </slot>
  <slot name="bottom-handle"></slot>
</ObjectPreviewLayout>
```

It should apply the default behavior, e.g. toggling the code editor.

We can then have a `CanvasPreviewLayout` for the canvas nodes, which build on top of `ObjectPreviewCanvas`. The only difference is that it will render a `<canvas>` element in the preview slot. Now you no longer need the `preview` slot to be set manually.

```svelte
<CanvasPreviewLayout
  title="canvas"
  // used to provide selection outline around the canvas
  selected={selected}
  onrun={onRun}
  on-playback-toggle={onPlaybackToggle}
  paused={paused}
  preview-canvas={canvasElement}
>
  <slot name="top-handle"></slot>
  <slot name="code-editor">
    <CodeEditor value={code} language="glsl" ... />
  </slot>
  <slot name="bottom-handle"></slot>
</CanvasPreviewLayout>
```
