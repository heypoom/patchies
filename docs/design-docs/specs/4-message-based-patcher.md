# 4. Message-Based Patcher

We want to implement a system for message-based patching, with concepts such as objects, wires and message passing, which is borrowed from Max/MSP and PureData.

## Concepts

- **Messages** are data that are sent from one object to another.
  - Messages have data types. The data type can be custom, such as `bang` (the simplest data type)
- **Objects** are nodes on the graph.
  - Objects can send messages. Examples:
    - A _bang_ object sends out a message of type "bang"
    - A _message_ object could send messages when the box is clicked.
    - A _clock_ object could send a message every second.
  - Objects can receive messages.
    - An object's `on_message` callback are called when a new message arrives. Messages are delivered sequentially through a queue.
    - For example, when a _traffic light_ object receives any kind of message, it changes its internal state from `red -> green -> blue`
- **Wires** connect two objects together.
- **Inlets** and **Outlets** are slots to connect two objects together.

  - Inlets are inputs where messages flow into the object.
  - Outlets are outputs where messages flow out of the object.
  - They must be given a name.
  - They are untyped by default, which means it accepts any kind of message, and requires no validation.
  - They can be typed, which means that inlet/outlet will validate the source/destination outlet type, and throw an error if the data type mismatches.

- **Props** are key-value pairs that defines the setting of an object.

  - They can be updated dynamically via messages.
  - They can be set manually.

## Simple Use Case

This demo shows how to create a generator that sends either a red or green color randomly every half a second, and a p5.js canvas that draws a circle with the received color.

Graph layout: two nodes connected: `js -> p5.canvas`.

JS block:

```js
interval(() => {
  send(Math.random() > 0.5 ? '#ff0000' : '#00ff00')
}, 500)
```

P5 canvas block:

```js
let color = '#ff0000'

function onMessage(m) {
  color = m.data
}

function setup() {
  createCanvas(200, 200)
}

function draw() {
  background(100, 200, 300)
  fill(color)
  ellipse(width / 2, height / 2, 100, 100)
}
```

### Constructs for the JavaScript blocks

These constructs are exposed to JavaScript-based objects, such as `js`, `p5.canvas` and `hydra`.

- `send(data)` - Sends a message with the given data to the next object in the graph.
  - `send(data, {type})` - specify the data type of the message.
- `function onMessage(callback: (message) => void)` - Defines a callback that is called when a new message arrives.
- `interval(callback: () => void, ms: number)` - Calls the callback every `ms` milliseconds. Does automatic cleanup when the object is unloaded. Use this instead of `setInterval` to avoid memory leaks.
