# JavaScript

Patchies provides a JavaScript API available in all JS-enabled objects — from `js` and `worker` to visual objects like `p5`, `canvas`, `hydra`, and `three`. Use it to send and receive messages, run timers, react to audio, and add custom logic to any part of your patch.

> ✨ [Try the starter patch](/?id=9c5ytrchpoazlez) to see message passing in action.

## Supported Objects

These objects all run JavaScript and share the same API described on this page:

[js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [canvas.dom](/docs/objects/canvas.dom), [textmode](/docs/objects/textmode), [textmode.dom](/docs/objects/textmode.dom), [three](/docs/objects/three), [three.dom](/docs/objects/three.dom), [hydra](/docs/objects/hydra), [dom](/docs/objects/dom), [vue](/docs/objects/vue), [sonic~](/docs/objects/sonic~), [tone~](/docs/objects/tone~), [elem~](/docs/objects/elem~)

Expression objects like [filter](/docs/objects/filter), [map](/docs/objects/map), [tap](/docs/objects/tap), and [scan](/docs/objects/scan) evaluate code *once per incoming message* and cannot use messaging or timer functions.

---

## Your First JS Object

Create a `js` object (press `Enter` and type `js`). You'll see a code editor. Try this:

```javascript
// Receive a message and send back its double
recv((data) => {
  send(data * 2);
});
```

Connect a `slider` to the inlet, and a `peek` to the outlet. Drag the slider — the doubled value appears in `peek`.

> **Tip**: Use `console.log()` to print values to the virtual console (open it with the console button in the toolbar). It shows output from your JS objects, separate from the browser console.

---

## Essentials

### Logging

```javascript
console.log("Hello!");
console.log("The value is:", 42);
```

Output appears in the virtual console inside Patchies, not the browser's DevTools console.

### Sending & Receiving Messages

Use `send()` to output a value from your object, and `recv()` to listen for incoming messages:

```javascript
// Send a message out of the default outlet
send({ type: "bang" });
send(42);
send("hello world");

// Receive messages from connected inlets
recv((data) => {
  console.log("Got:", data);
  send(data); // forward it
});
```

You can check which inlet a message came from using `meta.inlet`:

```javascript
recv((data, meta) => {
  if (meta.inlet === 0) {
    console.log("From inlet 0:", data);
  } else {
    console.log("From inlet 1:", data);
  }
});
```

#### Multiple Inlets & Outlets

Use `setPortCount(inletCount, outletCount)` to add inlets and outlets:

```javascript
setPortCount(2, 1); // 2 inlets, 1 outlet

recv((data, meta) => {
  // Route the message out a specific outlet
  send(data, { to: meta.inlet });
});
```

#### Sending to a Specific Outlet

```javascript
send("first",  { to: 0 }); // outlet 0
send("second", { to: 1 }); // outlet 1
```

### Timers

All timers clean up automatically when you edit the code or remove the object — no memory leaks:

```javascript
// Run every 500ms
setInterval(() => {
  send({ type: "bang" });
}, 500);

// Run once after 1 second
setTimeout(() => {
  send("done!");
}, 1000);

// Wait before continuing (works with top-level await)
await delay(2000);
send("2 seconds later");

// Run on every animation frame
requestAnimationFrame(() => {
  // great for smooth visual updates
});
```

> **Important**: Always use the Patchies versions (`setInterval`, `setTimeout`, `requestAnimationFrame`) — not `window.setInterval` etc. The Patchies versions clean up automatically; the window versions will keep running even after you change your code.

### Top-Level Await

You can use `await` directly at the top level of your script:

```javascript
await delay(1000);
send("started after 1 second");
```

This is useful for sequencing things or waiting for data before starting.

### Custom Cleanup

Register code that runs when your object is removed or the code is re-executed:

```javascript
const socket = new WebSocket("wss://example.com");

onCleanup(() => {
  socket.close();
  console.log("Cleaned up!");
});
```

### Display Title

Change the label shown on the object in the patch:

```javascript
setTitle("counter: 0");

let count = 0;
setInterval(() => {
  count++;
  setTitle(`counter: ${count}`);
}, 1000);
```

---

## Named Channels (Wireless Messaging)

Connect objects without drawing cables by using named channels. This is handy for sending data across a large patch.

```javascript
// Send to a named channel from one object
send({ x: 100, y: 200 }, { to: 'position' });

// Receive from that channel in another object
recv((data, meta) => {
  console.log(data);           // { x: 100, y: 200 }
  console.log(meta.channel);   // 'position'
  console.log(meta.source);    // ID of the sender object
}, { from: 'position' });
```

The `to` option handles both cables and channels:

```javascript
send(data, { to: 0 });          // outlet 0 (cable)
send(data, { to: 'position' }); // named channel (wireless)
```

Named channels work between `js`, `worker`, and the visual [send](/docs/objects/send)/[recv](/docs/objects/recv) objects.

---

## Audio Reactivity

Connect an `fft~` object to your js object and call `fft()` to read frequency data:

```javascript
const data = fft(); // Float32Array of frequency values (0–255)
const bass = data[2];
const treble = data[data.length - 10];
```

See [Audio Reactivity](/docs/audio-reactivity) for a full walkthrough.

---

## Clock & Beat Sync

The `clock` object gives you access to the global transport for beat-synced animations and scheduling:

```javascript
// Read transport state at any time
clock.time    // seconds elapsed
clock.beat    // current beat (0 to beatsPerBar-1)
clock.phase   // position within current beat (0.0 → 1.0)
clock.bpm     // current tempo

// Run something on every downbeat
clock.onBeat(0, () => {
  background(255); // flash white
});

// Run something every bar
clock.every('1:0:0', () => {
  send({ type: 'bang' });
});
```

See [Clock API](/docs/clock-api) for the full scheduling reference.

---

## Presentation

Control how other objects appear in the patch. Use `Ctrl/Cmd + Shift + C` to copy an object's ID, and `Shift + Drag` to select multiple.

```javascript
// Pan and zoom the canvas to focus on specific objects
focusObjects({ nodes: [{ id: 'canvas-1' }], duration: 800, padding: 0.3 });

// Set a visual object as the fullscreen background output
setBackgroundOutput('canvas-1');
setBackgroundOutput(null); // clear it

// Pause / unpause objects by ID
pauseObject('p5-1');
unpauseObject('p5-1');
```

---

## AI (Gemini)

Call Google's Gemini API directly from your patch:

```javascript
const result = await llm("Generate a JSON list of 5 colors");
console.log(result);

// Include a visual object's current frame as context
const description = await llm("What's in this frame?", {
  imageNodeId: "canvas-1",
});
```

Requires a Gemini API key — set it via `Ctrl/Cmd + K > Gemini`.

---

## Importing Packages

Use the `npm:` prefix to import any package from npm (powered by [esm.sh](https://esm.sh)):

```javascript
import Matter from "npm:matter-js";
import { uniq } from "npm:lodash-es";

console.log(uniq([1, 1, 2, 2, 3])); // [1, 2, 3]
```

Or import dynamically with `await`:

```javascript
// Using a full URL
const { uniq } = await import("https://esm.sh/lodash-es");

// Using the shorthand (equivalent)
const { uniq } = await esm("lodash-es");
```

> **Note**: `import * as X from "npm:..."` is not yet supported. Use named or default imports instead.

---

## Virtual Filesystem

Load images, videos, fonts, and other files from the patch's virtual filesystem:

```javascript
const url = await getVfsUrl("my-image.png");
const img = loadImage(url); // works in p5, for example
```

See [Virtual Filesystem](/docs/virtual-filesystem) for how to add files to your patch.

---

## Persistent Storage

Use `kv` to store data that survives page reloads:

```javascript
// Save a value
await kv.set("score", 100);

// Read it back later
const score = await kv.get("score"); // 100

// Namespaced stores
const settings = kv.store("settings");
await settings.set("theme", "dark");
```

See [Data Storage](/docs/data-storage) for more.

---

## Shared Libraries

![Shared JavaScript libraries example](/content/images/patchies-js-modules.png)

Share code between multiple `js` objects using the `// @lib <name>` comment at the top of a js object. This turns it into a library that others can import from:

```javascript
// In a js object — add "// @lib utils" at the very top
// @lib utils
export const rand = (min, max) => Math.random() * (max - min) + min;
export class Vector { /* ... */ }
```

```javascript
// In any other js object
import { rand, Vector } from 'utils';
console.log(rand(0, 10));
```

The library object shows a package icon in the patch. Any change to it automatically re-runs all importers.

> **Note**: Top-level variables are *not* shared between objects — each object has its own isolated scope. Use message passing or named channels to communicate values between objects at runtime.

---

## See Also

- [Clock API](/docs/clock-api) — Beat-synced timing and scheduling
- [Transport Control](/docs/transport-control) — Global play/pause, BPM, time display
- [Message Passing](/docs/message-passing) — How objects exchange data
- [Audio Reactivity](/docs/audio-reactivity) — Using FFT data in visuals
- [Canvas Interaction](/docs/canvas-interaction)
- [Virtual Filesystem](/docs/virtual-filesystem)
- [Data Storage](/docs/data-storage)
