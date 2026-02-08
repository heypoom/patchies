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

## Canvas Interaction

- `noDrag()`, `noPan()`, `noWheel()`, `noInteract()` - see
  [Canvas Interaction](/docs/canvas-interaction)

## Shadow DOM

The Vue component is mounted under an open
[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Shadow_DOM_API)
to isolate the DOM tree from the rest of the page.

## See Also

- [dom](/docs/objects/dom) - vanilla JS interfaces
- [JavaScript Runner](/docs/javascript-runner) - messaging API
