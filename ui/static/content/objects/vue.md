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

Call `hideBorder()` when the Vue UI should blend into the patch without
showing Patchies' border or selected glow. Remove
the call and run the node again to restore the border.

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

## See Also

- [dom](/docs/objects/dom) - vanilla JS interfaces
- [HTML in Canvas](/docs/html-in-canvas) - Experimental HTML rendering APIs
- [JavaScript Runner](/docs/javascript-runner) - messaging API
