Build custom UI components using [Vue.js 3](https://vuejs.org) with the
Composition API.

## Template

Specify the template in `createApp({template})` as a string, or use
hyperscript via `h()` for more complex components.

## Available APIs

These Vue.js objects and modules are exposed:

- `Vue` (the entire Vue.js module)
- `createApp`, `ref`, `reactive`, `computed`
- `watch`, `watchEffect`
- `onMounted`, `onUnmounted`
- `nextTick`, `h`, `defineComponent`

## Styling

TailwindCSS is enabled by default. Call `tailwind(false)` to disable it.

Call `noBorder()` when the Vue UI should blend into the patch without
showing Patchies' border or selected glow. Remove
the call and run the node again to restore the border.

## Expand

Choose **Expand** from the overflow menu or right-click menu to focus the live
Vue interface on screen. The app keeps running and remains interactive.
Patchies preserves the preview's current aspect ratio, scales it to fit the
screen, and uses black space where needed instead of stretching the layout.

Expand also works with HTML-in-Canvas modes. It changes only where the live
preview is shown; video output and canvas layers keep running as before.

## Resizable layouts

Use `setFluidSize()` when your component should fill a user-resized node:

```js
setFluidSize({ initialSize: { width: 400, height: 240 }, resize: 'vertical' });

onResize(({ height }) => {
  console.log(`Resized to ${height}px high`);
});
```

`resize` can be `'horizontal'`, `'vertical'`, or `'both'` (the default).
`keepAspectRatio`, `showResizer`, and `initialSize` work like `canvas.dom`.
Users can enable or disable the resize handles from the overflow menu.

## Canvas Interaction

- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see
  [Canvas Interaction](/docs/canvas-interaction)

For selective control, add these CSS classes directly to elements in your template:

| Class | Effect |
| --- | --- |
| `nodrag` | Prevents dragging the node when interacting with this element |
| `nopan` | Prevents canvas panning when interacting with this element |
| `nowheel` | Prevents canvas zoom when scrolling over this element |

```js
createApp({
  template: `
    <input class="nodrag" type="range" v-model="value" />
    <div class="nowheel overflow-y-auto h-32">scrollable list</div>
  `
}).mount(root)
```

## Shadow DOM

The Vue component is mounted under an open
[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Shadow_DOM_API)
to isolate the DOM tree from the rest of the page.

## HTML-in-Canvas

`vue` supports experimental HTML in Canvas APIs for video output and local
canvas or GLSL layers. See [HTML in Canvas](/docs/html-in-canvas) for
`htmlCanvas.videoOutput()`, `htmlCanvas.canvasLayer()`, and
`htmlCanvas.glslLayer()`.

## Presets

- `File Browser` — a resizable file explorer that demonstrates `vfs.list()`, `vfs.search()`, and `vfs.getUrl()`.

## See Also

- [dom](/docs/objects/dom) - vanilla JS interfaces
- [canvas.dom](/docs/objects/canvas.dom) - Canvas widgets
- [HTML in Canvas](/docs/html-in-canvas) - Experimental HTML rendering APIs
- [JavaScript Runner](/docs/javascript-runner) - messaging API
