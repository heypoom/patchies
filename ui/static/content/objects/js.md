The `js` object provides a full JavaScript environment with access to the [Patchies JavaScript Runner](/docs/javascript-runner) features such as `send`, `recv`, `setPortCount`, `onCleanup`, NPM imports, virtual filesystem and shared libraries.

## Special Methods

These methods are exclusive to the `js` object:

- **`setRunOnMount(true)`** - run the code automatically when the object is created. By default, code only runs when you hit the "Play" button.
- **`flash()`** - briefly flash the node's border, useful for visual feedback when processing messages.

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
