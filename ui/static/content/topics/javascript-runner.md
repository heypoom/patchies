# JavaScript

Patchies provides a couple of JavaScript methods that you can use in JS-enabled objects.

## Supported objects

All methods are available in these objects: [js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [canvas.dom](/docs/objects/canvas.dom), [textmode](/docs/objects/textmode), [textmode.dom](/docs/objects/textmode.dom), [three](/docs/objects/three), [three.dom](/docs/objects/three.dom), [hydra](/docs/objects/hydra), [dom](/docs/objects/dom), [vue](/docs/objects/vue), [sonic~](/docs/objects/sonic~), [tone~](/docs/objects/tone~) and [elem~](/docs/objects/elem~).

Some expression-like objects e.g. [filter](/docs/objects/filter), [map](/docs/objects/map), [tap](/docs/objects/tap), [scan](/docs/objects/scan) evaluates the expression _once_ on message. These objects cannot use messaging and timer functions like `send`, `recv`, `onCleanup`, `setInterval`, etc.

## Essentials

### Console

Use `console.log()` to log messages to the virtual console (not the browser console).

### Title

- `setTitle(title)` - set the display title of the object

### Messaging

- `setPortCount(inletCount, outletCount)` - set the number of message inlets and outlets
- `send(message)` - send a message out of the default outlet
- `send(message, { to: outlet })` - send a message out of a specific outlet (0-indexed)
- `recv(callback)` - receive messages from connected inlets

Use `meta.inlet` in the `recv` callback to distinguish which inlet the message came from.

### Timers

All timers are automatically cleaned up when the object is unmounted or code is re-executed:

- `setInterval(callback, ms)` - runs callback every `ms` milliseconds
- `setTimeout(callback, ms)` - runs callback after `ms` milliseconds
- `delay(ms)` - returns a Promise that resolves after `ms` milliseconds
- `requestAnimationFrame(callback)` - schedules callback for next animation frame

**Important**: Do not use `window.setInterval`, `window.setTimeout`, or `window.requestAnimationFrame` as they will not clean up automatically.

### Top-level Async

Top-level `await` is supported.
For example, use `await delay(ms)` to pause execution.

### Custom Cleanup

Use `onCleanup(callback)` to register cleanup logic that runs when the object is unmounted or code is re-executed. Useful for disconnecting resources or unsubscribing from events.

### Audio Reactivity

Use `fft()` to get audio frequency analysis from a connected `fft~` object. See [Audio Reactivity](/docs/audio-reactivity).

### Named Channels

Send and receive messages wirelessly using named channels:

```javascript
// Send to a named channel (broadcasts to all listeners)
send({ x: 100 }, { to: 'position' });

// Receive from a named channel
recv((data, meta) => {
  console.log(data);           // the message
  console.log(meta.channel);   // 'position'
  console.log(meta.source);    // sender's object ID
}, { from: 'position' });
```

The `to` option is overloaded - a number routes to an outlet, a string broadcasts to a channel.

Named channels work across `js`, `worker`, and visual `send`/`recv` objects. This enables wireless communication without visual connections.

### Presentation

These methods requires the object's id. Use `Ctrl/Cmd + Shift + C` to copy selected object ids, and `Shift + Drag` to select multiple objects.

- `focusObjects(options)` - pan and zoom the canvas using xy-flow's `fitView` options.

  ```javascript
  focusObjects({ nodes: [{ id: 'node-1' }], duration: 800, padding: 0.3 });
  ```

- `setBackgroundOutput(id)` - set a object as the background visual output by ID (same as "Output to background" in the UI), ass `null` to clear

  ```javascript
  setBackgroundOutput('canvas-1');
  setBackgroundOutput(null); // clear
  ```

- `pauseObject(id)` - pause a object by ID (works on visual objects, js, worker, MediaPipe, and any object that supports pausing).

  ```javascript
  pauseObject('p5-1');
  ```

- `unpauseObject(id)` - unpause a object by ID

  ```javascript
  unpauseObject('p5-1');
  ```

### Clock & Timing

The `clock` object provides beat-synced timing from the global transport:

```javascript
clock.time    // seconds
clock.beat    // current beat (0-3)
clock.phase   // position in beat (0.0-1.0)
clock.bpm     // tempo

// Schedule callbacks
clock.onBeat(0, () => flash());
clock.every('1:0:0', () => pulse());
```

See [Clock API](/docs/clock-api) for full scheduling documentation.

### AI

Use `await llm(prompt, options?)` to call Google's Gemini API, using Gemini 3 Flash:

```javascript
await llm("Generate a JSON of happy birthday");

// With options.
// Use Ctrl/Cmd + Shift + C to copy object id.
await llm("What's in this frame?", {
  abortSignal: controller.signal,
  imageNodeId: "glsl-54",  // include visual object output as context
});
```

Requires a Gemini API key set in settings: `Ctrl/Cmd + K > Gemini`

## Importing NPM Packages

Use the `npm:` prefix in import statements (uses [esm.sh](https://esm.sh) under the hood). Note: `import * as X` is not yet supported.

```javascript
import Matter from "npm:matter-js";
import { uniq } from "npm:lodash-es";

console.log(uniq([1, 1, 2, 2, 3, 3])); // [1, 2, 3]
```

Or use dynamic imports:

```javascript
const { uniq } = await import("https://esm.sh/lodash-es");

// or use the shorthand
const { uniq } = await esm("lodash-es");
```

## Virtual Filesystem

Use `await getVfsUrl(path)` to load images, videos, fonts, and other assets from the virtual filesystem. See [Virtual Filesystem](/docs/virtual-filesystem) for full documentation.

## Persistent Storage

Use `kv` to store data that persists across sessions. See [Data Storage](/docs/data-storage) for details.

```javascript
await kv.set("counter", 42);
await kv.store("settings").set("theme", "dark");
await kv.get("counter"); // 42
```

## Shared Libraries

![Shared JavaScript libraries example](/content/images/patchies-js-modules.png)

Share code across multiple `js` blocks using the `// @lib <name>` comment. This turns the object into a library object, shown by the package icon:

```javascript
// In a js object with "// @lib utils" at the top:
export const rand = () => Math.random();
export class Vector { /* ... */ }

// In other objects:
import { rand, Vector } from 'utils';
```

Note: Constants are NOT shared across objects. Each object has its own isolated execution context. Use message passing to communicate between objects.

## See Also

- [Clock API](/docs/clock-api) - Beat-synced timing and scheduling
- [Transport Control](/docs/transport-control) - Global play/pause, BPM, time display
- [Virtual Filesystem](/docs/virtual-filesystem) - Loading files and assets
- [Data Storage](/docs/data-storage) - Persistent key-value storage
- [Canvas Interaction](/docs/canvas-interaction)
- [Audio Reactivity](/docs/audio-reactivity)
- [Message Passing](/docs/message-passing)
