# Message Passing

Each object can send messages to other objects, and receive messages from other objects.

![Message passing example](/content/images/patchies-message-pass.png)

In this example, two `slider` objects sends out their value to a `expr $1 + $2` object which adds the number together. The result is sent as a message to the `p5` object which displays it.

## Getting Started with Messages

![Basic examples](/content/images/basic-examples.webp)

> ✨ [Try this patch](/?id=9c5ytrchpoazlez) to see message passing in action!

- Create two `button` objects, and connect the outlet of one to the inlet of another
  - When you click on the first button, it will send a `bang` message to the second button, which will flash
  - In JavaScript, you will receive this as an object: `{type: 'bang'}`

- Create a `msg` object with the message `'hello world'` (you can hit `Enter` and type `m 'hello world'`). Mind the quotes.
  - Then, hit `Enter` again and search for the `logger.js` preset. Connect them together.
  - When you click on the message object, it will send the string `'hello world'` to the console object, which will log it to the virtual console.

## Message Types

Most messages in Patchies are objects with a `type` field:
- `bang` is `{type: 'bang'}`
- `start` is `{type: 'start'}`
- Add more fields as needed: `{type: 'loop', value: false}`

Typing `bang` in the message box sends `{type: 'bang'}` for convenience. If you want to send a string "bang", type in `"bang"` with quotes.

![Implicit message type](/content/images/message-passing-bang-meow.webp)

## Using send() and recv()

In every object that supports JavaScript (e.g. `js` and `p5`), use `send()` and `recv()` functions:

```javascript
// In the source `js` object
send({ type: "bang" });
send("Hello from Object A");

// In the target `js` object
recv((data) => {
  console.log("Received message:", data);
});
```

> **Tip**: To see what kind of messages an object is sending out, use the `logger.js` preset. It logs every incoming message to the console.

## Multiple Inlets and Outlets

The `recv` callback accepts a `meta` argument with the `inlet` field:

```javascript
// If the message came from inlet #2, send it out to outlet #2
recv((data, meta) => {
  send(data, { to: meta.inlet });
});
```

Use `setPortCount(inletCount, outletCount)` to set the exact number of message inlets and outlets:

```javascript
setPortCount(2, 1); // 2 message inlets, 1 message outlet
```

## Named Channels (Wireless Messaging)

Connect distant objects without visual cables using named channels.

### Visual Objects

Create [`send <channel>`](/docs/objects/send) and [`recv <channel>`](/docs/objects/recv) objects anywhere in your patch. Messages sent to the `send` inlet appear at matching `recv` outlets:

```text
[button] → [send foo]     ...     [recv foo] → [peek]
```

### JavaScript API

Use `send()` with a string `to` option for channel routing, and `recv()` with `from`:

```javascript
// Send to a named channel
send({ x: 100 }, { to: 'position' });

// Receive from a named channel
recv((data, meta) => {
  console.log(data);           // the message
  console.log(meta.channel);   // 'position'
  console.log(meta.source);    // sender's node ID
}, { from: 'position' });
```

The `to` option is overloaded - a number routes to an outlet index, a string broadcasts to a channel:

```javascript
send(data, { to: 0 });          // send via outlet 0 (edge-based)
send(data, { to: 'position' }); // broadcast to 'position' channel
```

Visual objects and JavaScript code are interoperable on the same channel - a `send foo` object broadcasts to both `recv foo` objects and `recv(callback, { from: 'foo' })` listeners.

## See Also

- [JavaScript Runner](/docs/javascript-runner) - Full API reference
- [Connecting Objects](/docs/connecting-objects)
- [Connection Rules](/docs/connection-rules)
