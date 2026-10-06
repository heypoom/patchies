The `js` object provides a full JavaScript environment with access to the [Patchies JavaScript Runner](/docs/javascript-runner) features such as `send`, `recv`, `setPortCount`, `onCleanup`, NPM imports, virtual filesystem and shared libraries.

## Special Methods

These methods are exclusive to the `js` object:

- **`setRunOnMount(true)`** - run the code automatically when the object is created. By default, code only runs when you hit the "Play" button.
- **`flash()`** - briefly flash the node's border, useful for visual feedback when processing messages.
- **`setPrimaryButton('run' | 'settings' | 'code')`** - choose the main action for the current layout. See [Primary Button](#primary-button) below.

## Primary Button

Use `setPrimaryButton()` to choose the action you reach for most. Without the
virtual console, the default large button runs or pauses your script and the
floating button opens Edit code.

```js
await settings.define([
  { key: 'gain', label: 'Gain', type: 'number', default: 0.75 }
]);
setPrimaryButton('settings');
```

In compact layout, `'settings'` makes the large button open Settings and moves
Run / Pause to the floating button. Edit code is in the overflow menu.
`'code'` makes the large button open Edit code, puts Run / Pause in the floating
button, and keeps Settings in the overflow menu. Use `'run'` to restore the
default layout.

With the virtual console visible, Run / Pause stays in the console. The floating
button opens Settings in `'settings'` mode and Edit code in every other mode.

The choice is saved with the node and preserved when you show or hide the
console. Without visible settings fields, `'settings'` uses the default layout
until your script defines controls.

## OpenCV

Use `await opencv()` to lazy-load OpenCV.js and wait for its WebAssembly runtime.
The module is cached across `js` objects, so separate nodes do not repeat initialization.

```js
const cv = await opencv();
const source = cv.matFromImageData(imageData);
const gray = new cv.Mat();

cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);

source.delete();
gray.delete();
```

OpenCV allocations are manual: call `.delete()` on every `Mat`, vector, and other
OpenCV object when you finish using it.

## Examples

Here is how to log incoming messages while also flashing the console.

```js
setRunOnMount(true)
setPortCount(1, 0)

recv((data) => {
  console.log(data);
  flash();
});
```

## See Also

- [worker](/docs/objects/worker) - run JavaScript in a Web Worker thread
- [JavaScript Runner](/docs/javascript-runner) - full API reference
