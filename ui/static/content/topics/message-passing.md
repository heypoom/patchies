# Message Passing

Messages are how objects talk to each other in Patchies. Draw a cable from one object's outlet to another's inlet, and data flows along it whenever the source sends something — a number, a string, a bang, or any custom value you like.

![Message passing example](/content/images/patchies-message-pass.png)

In this patch, two `slider` objects send their values to `expr $1 + $2`, which adds them and forwards the result to a `p5` object for display.

> **Note**: Objects like [expr](/docs/objects/expr) use [hot and cold inlets](/docs/hot-cold-inlets). Only the leftmost inlet (`$1`) triggers output — other inlets store their value silently until the hot inlet fires.

## Try It

![Basic examples](/content/images/basic-examples.webp)

> ✨ [Open this patch](/?id=9c5ytrchpoazlez) to see message passing live.

### Exercise 1 — Button chain

1. Create two `button` objects (`Enter` → type `button`)
2. Connect the outlet of the first to the inlet of the second
3. Click the first button — it sends a `bang`, causing the second to flash

### Exercise 2 — Text message

1. Create a `msg` object (`Enter` → type `m 'hello world'`). Mind the single quotes.
2. Search for the `logger.js` preset and connect `msg` → `logger.js`
3. Click the message object — `'hello world'` appears in the virtual console

## Message Types

Most Patchies messages are plain JavaScript values:

| Value | Example | When to use |
| --- | --- | --- |
| Bang | `{ type: 'bang' }` | Trigger something, no data needed |
| Number | `42`, `0.5` | Sliders, knobs, sensor values |
| String | `"hello"` | Text, commands, labels |
| Object | `{ type: 'note', pitch: 60 }` | Structured data with named fields |

The message box has a shorthand: typing `bang` sends `{ type: 'bang' }` automatically. To send the literal string `"bang"`, wrap it in quotes.

![Implicit message type](/content/images/message-passing-bang-meow.webp)

## Sending & Receiving in JavaScript

In any JS-enabled object (`js`, `p5`, `canvas`, `hydra`, etc.), use `send()` and `recv()`:

```javascript
// Send from one object...
send({ type: "bang" });
send(42);
send("hello");

// ...receive it in another
recv((data) => {
  console.log("Got:", data);
});
```

> **Tip**: Drop in the `logger.js` preset and connect anything to it — it prints every incoming message to the virtual console, making it easy to inspect what's flowing through a cable.

See [JavaScript Runner](/docs/javascript-runner) for the full API: multiple inlets and outlets, named channels, timers, and more.

## Named Channels (Wireless Messaging)

You don't always need a cable. Named channels let objects communicate across any distance in the patch — useful when cables would make the patch hard to read.

Create a [`send <name>`](/docs/objects/send) object and a matching [`recv <name>`](/docs/objects/recv) object anywhere in the patch:

```text
[button] → [send kick]          [recv kick] → [p5]
```

Any message arriving at `send kick`'s inlet immediately appears at every `recv kick`'s outlet — no cable required.

Visual `send`/`recv` objects and the JavaScript `send()`/`recv()` API share the same channel system and are fully interoperable. See [JavaScript Runner](/docs/javascript-runner) for the JS syntax.

## See Also

- [JavaScript Runner](/docs/javascript-runner) — Full JS API: multiple ports, named channels, timers
- [Hot and Cold Inlets](/docs/hot-cold-inlets) — Control when objects trigger output
- [Connecting Objects](/docs/connecting-objects)
- [Data Types](/docs/data-types)
