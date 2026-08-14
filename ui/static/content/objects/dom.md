Build custom UI components using vanilla JavaScript and the DOM API.

## Root Element

`root` provides the root element that you can modify:

```js
root.innerHTML = 'hello';
```

## Styling

TailwindCSS is enabled by default. Call `tailwind(false)` to disable it.

Call `noBorder()` when the DOM UI should blend into the patch without
showing Patchies' border or selected glow. Remove
the call and run the node again to restore the border.

## Resizable layouts

Use `setFluidSize()` when your interface should fill a user-resized node:

```js
setFluidSize({ initialSize: { width: 400, height: 240 }, resize: 'horizontal' });

onResize(({ width }) => {
  root.style.setProperty('--panel-width', `${width}px`);
});
```

`resize` can be `'horizontal'`, `'vertical'`, or `'both'` (the default).
`keepAspectRatio`, `showResizer`, and `initialSize` work like `canvas.dom`.
Users can enable or disable the resize handles from the overflow menu.

## Canvas Interaction

- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see
  [Canvas Interaction](/docs/canvas-interaction)

For selective control, add these CSS classes directly to individual elements:

| Class | Effect |
| --- | --- |
| `nodrag` | Prevents dragging the node when interacting with this element |
| `nopan` | Prevents canvas panning when interacting with this element |
| `nowheel` | Prevents canvas zoom when scrolling over this element |

```js
root.innerHTML = `
  <input class="nodrag" type="range" min="0" max="100" />
  <div class="nowheel overflow-y-auto h-32">scrollable list</div>
`;
```

## Shadow DOM

The `root` element runs under an open
[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Shadow_DOM_API)
to isolate the DOM tree from the rest of the page.

## HTML-in-Canvas

`dom` supports experimental HTML-in-Canvas APIs for video output and local
canvas or GLSL layers. See [HTML in Canvas](/docs/html-in-canvas) for
`htmlCanvas.videoOutput()`, `htmlCanvas.canvasLayer()`, and
`htmlCanvas.glslLayer()`.

## See Also

- [vue](/docs/objects/vue) - Vue.js interfaces
- [canvas.dom](/docs/objects/canvas.dom) - Canvas widgets
- [HTML in Canvas](/docs/html-in-canvas) - Experimental HTML rendering APIs
- [JavaScript Runner](/docs/javascript-runner) - messaging API
