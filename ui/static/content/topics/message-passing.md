# Message Passing

Each object can send messages to other objects, and receive messages from other objects.

![Message passing example](/content/images/patchies-message-pass.png)

In this example, two `slider` objects send their value to an `expr $1 + $2` object which adds them together. The result is sent as a message to the `p5` object which displays it.

> **Note**: Objects like [expr](/docs/objects/expr) use [hot and cold inlets](/docs/hot-cold-inlets). Only the first inlet (`$1`) triggers output. Other inlets store values silently.

## Getting Started with Messages

![Basic examples](/content/images/basic-examples.webp)

> ✨ [Try this patch](/?id=9c5ytrchpoazlez) to see message passing in action!

- Create two `button` objects and connect the outlet of one to the inlet of another.
  - When you click the first button, it sends a `bang` message to the second button, which will flash.
  - In JavaScript, you receive this as: `{ type: 'bang' }`

- Create a `msg` object with the message `'hello world'` (press `Enter`, type `m 'hello world'`). Mind the quotes.
  - Then search for the `logger.js` preset and connect them. Clicking the message object logs `'hello world'` to the virtual console.

## Message Types

Most messages in Patchies are objects with a `type` field:

- `bang` is `{ type: 'bang' }`
- `start` is `{ type: 'start' }`
- Add more fields as needed: `{ type: 'loop', value: false }`

Typing `bang` in the message box sends `{ type: 'bang' }` for convenience. To send the literal string `"bang"`, use quotes.

![Implicit message type](/content/images/message-passing-bang-meow.webp)

## Using send() and recv() in JavaScript

In any JS-enabled object (e.g. `js`, `p5`), use `send()` and `recv()`:

```javascript
// In the source object
send({ type: "bang" });
send("Hello from Object A");

// In the target object
recv((data) => {
  console.log("Received:", data);
});
```

> **Tip**: Use the `logger.js` preset to inspect messages — it logs every incoming message to the virtual console.

See [JavaScript Runner](/docs/javascript-runner) for the full API: multiple inlets/outlets, named channels, timers, and more.

## Named Channels (Wireless Messaging)

Connect distant objects without drawing cables using named channels.

Create [`send <channel>`](/docs/objects/send) and [`recv <channel>`](/docs/objects/recv) objects anywhere in your patch. Messages sent to the `send` inlet appear at matching `recv` outlets — no cable needed:

```text
[button] → [send foo]     ...     [recv foo] → [peek]
```

Visual `send`/`recv` objects and JavaScript's `send()`/`recv()` API are interoperable on the same channel — see [JavaScript Runner](/docs/javascript-runner) for the JS syntax.

## See Also

- [JavaScript Runner](/docs/javascript-runner) — Full JS API for messaging, timers, and more
- [Hot and Cold Inlets](/docs/hot-cold-inlets) — Control when objects trigger output
- [Connecting Objects](/docs/connecting-objects)
- [Connection Rules](/docs/connection-rules)
