# JavaScript

Patchies provides a JavaScript API for all JavaScript-enabled objects, including `js`, `worker`, `p5`, `canvas`, `hydra`, and `three`. Use the API to send and receive messages, run timers, react to audio, and add custom logic to a patch.

> ✨ [Try the starter patch](/?src=/demos/message-passing-basics.json) to see message passing in action.

## Supported Objects

These objects run JavaScript and share the API on this page:

[js](/docs/objects/js), [worker](/docs/objects/worker), [p5](/docs/objects/p5), [canvas](/docs/objects/canvas), [canvas.dom](/docs/objects/canvas.dom), [textmode](/docs/objects/textmode), [textmode.dom](/docs/objects/textmode.dom), [three](/docs/objects/three), [three.dom](/docs/objects/three.dom), [hydra](/docs/objects/hydra), [regl](/docs/objects/regl), [swgl](/docs/objects/swgl), [dom](/docs/objects/dom), [vue](/docs/objects/vue), [sonic~](/docs/objects/sonic~), [tone~](/docs/objects/tone~), [elem~](/docs/objects/elem~)

Expression objects, such as [filter](/docs/objects/filter), [map](/docs/objects/map), [tap](/docs/objects/tap), and [scan](/docs/objects/scan), evaluate code for each incoming message. They cannot use messaging or timer functions.

## Your First JS Object

1. Press `Enter` and type `js` to create a `js` object.
2. Enter this code in the editor:

```javascript
// Receive a message and send back its double
recv((data) => {
  send(data * 2);
});
```

Connect a `slider` to the inlet. Connect a `peek` to the outlet. Drag the slider to show the doubled value in `peek`.

> **Tip**: Use `console.log()` to print values to the virtual console. Open it with the console button in the toolbar. It shows output from JavaScript objects, separate from the browser console.

## Essentials

### Logging

```javascript
console.log("Hello!");
console.log("The value is:", 42);
```

Patchies shows this output in the virtual console, not the browser DevTools console.

### Sending & Receiving Messages

Use `send()` to send a value from an object. Use `recv()` to receive messages:

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

Use `meta.inlet` to check which inlet sent a message:

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

Use named channels to connect objects without cables. This helps you send data across a large patch.

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

The `to` option sends data through cables and channels:

```javascript
send(data, { to: 0 });          // outlet 0 (cable)
send(data, { to: 'position' }); // named channel (wireless)
```

Named channels work with `js`, `worker`, and the visual [send](/docs/objects/send) and [recv](/docs/objects/recv) objects.

### Timers

Patchies cleans up timers when you edit the code or remove the object:

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

> **Important**: Use the Patchies versions of `setInterval`, `setTimeout`, and `requestAnimationFrame`. Do not use `window.setInterval` and similar browser APIs. Patchies cleans up its versions. Browser timers continue after you change the code.

### Top-Level Await

Use `await` directly at the top level of a script:

```javascript
await delay(1000);
send("started after 1 second");
```

Use this to control sequence or wait for data.

### Custom Cleanup

Register code that runs when Patchies removes an object or runs its code again:

```javascript
const socket = new WebSocket("wss://example.com");

onCleanup(() => {
  socket.close();
  console.log("Cleaned up!");
});
```

### Display Title

Change the label that Patchies shows on an object:

```javascript
setTitle("counter: 0");

let count = 0;
setInterval(() => {
  count++;
  setTitle(`counter: ${count}`);
}, 1000);
```

> **Tip**: For VFS, storage, audio reactivity, clock, AI, and presentation APIs, see [JS Integrations](/docs/js-integrations).

## See Also

- [JS Modules](/docs/js-modules) — Import npm packages and share code between objects.
- [JS Integrations](/docs/js-integrations) — Use VFS, storage, audio, clock, AI, and other APIs.
- [Message Passing](/docs/message-passing) — Learn how objects exchange data.
- [Canvas Interaction](/docs/canvas-interaction) — Handle pointer input on the canvas.
