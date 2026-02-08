Build custom UI components using vanilla JavaScript and the DOM API.

## Root Element

`root` provides the root element that you can modify:

```js
root.innerHTML = 'hello';
```

## Styling

TailwindCSS is enabled by default. Call `tailwind(false)` to disable it.

## Canvas Interaction

- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see
  [Canvas Interaction](/docs/canvas-interaction)

## Shadow DOM

The `root` element runs under an open
[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Shadow_DOM_API)
to isolate the DOM tree from the rest of the page.

## See Also

- [vue](/docs/objects/vue) - Vue.js interfaces
- [JavaScript Runner](/docs/javascript-runner) - messaging API
