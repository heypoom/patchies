# JavaScript

Patchies provides a JavaScript API available in all JS-enabled objects — from `js` and `worker` to visual objects like `p5`, `canvas`, `hydra`, and `three`. Use it to send and receive messages, run timers, react to audio, and add custom logic to any part of your patch.

> ✨ [Try the starter patch](/?id=9c5ytrchpoazlez) to see message passing in action.

## Supported Objects

These objects all run JavaScript and share the same API described on this page:

[js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [canvas.dom](/docs/objects/canvas.dom), [textmode](/docs/objects/textmode), [textmode.dom](/docs/objects/textmode.dom), [three](/docs/objects/three), [three.dom](/docs/objects/three.dom), [hydra](/docs/objects/hydra), [regl](/docs/objects/regl), [swgl](/docs/objects/swgl), [dom](/docs/objects/dom), [vue](/docs/objects/vue), [sonic~](/docs/objects/sonic~), [tone~](/docs/objects/tone~), [elem~](/docs/objects/elem~)

Expression objects like [filter](/docs/objects/filter), [map](/docs/objects/map), [tap](/docs/objects/tap), and [scan](/docs/objects/scan) evaluate code *once per incoming message* and cannot use messaging or timer functions.

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

#### Named Channels (Wireless Messaging)

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

> **Tip**: For VFS, storage, audio reactivity, clock, AI, and presentation APIs, see [JS Integrations](/docs/js-integrations).

### Output Resolution

Visual objects (`three`, `regl`, `canvas`, `p5`, etc.) render at full
window resolution by default. For data textures or lightweight renders,
reduce the FBO size:

```javascript
setResolution(256)       // 256×256
setResolution(512, 256)  // 512 wide, 256 tall
setResolution('1/2')     // half resolution
setResolution('1/4')     // quarter resolution
```

Downstream nodes sample the smaller texture with bilinear filtering —
upscaling is automatic. Combine with `setTextureFormat('rgba32f')` for
GPGPU workflows like texture-encoded geometry.

> **Note**: GLSL and SwissGL nodes use the `// @resolution 256`
> directive instead of `setResolution()`. See
> [glsl](/docs/objects/glsl#output-resolution).

## See Also

- [JS Modules](/docs/js-modules) — Importing npm packages and sharing code between objects
- [JS Integrations](/docs/js-integrations) — VFS, storage, audio reactivity, clock, AI, and more
- [Message Passing](/docs/message-passing) — How objects exchange data
- [Canvas Interaction](/docs/canvas-interaction)
