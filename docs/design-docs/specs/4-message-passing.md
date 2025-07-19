# 4. Message-Based Patcher

We want to implement a system for message-based patching, with concepts such as objects, wires and message passing, which is borrowed from Max/MSP and PureData.

- Objects are nodes on the graph.
- Wires connect two objects together.
- Inlets and Outlets are the slots that you can connect wires to.
  - Inlets are inputs where messages flow into the object.
  - Outlets are outputs where messages flow out of the object.
  - They must be given a name.
  - They are untyped by default, which means it accepts any kind of message, and requires no validation.
  - They can be typed, which means that inlet/outlet will validate the source/destination outlet type, and throw an error if the data type mismatches.
- Properties are key-value pairs that defines the settings of an object.
  - They can be updated dynamically via messages.
  - They can be set manually.
- Messages are data that are sent from one object to another.
  - Messages have data types. The data type can be custom, such as `bang` (the simplest data type)
- Objects can send messages. For example:
  - A "bang" object sends out a message of type "bang"
  - For example, a "message" object could send messages when the box is clicked.
  - A "clock" object could send a message every second.
- Objects can receive messages.
  - An object's `on_message` callback are invoked immediately when a new message arrives, scheduled sequentially through a queue.
  - For example, when a "traffic light" object receives any kind of message, it changes its internal state from "red" -> "green" -> "blue"

The basic idea is that we should have a separate `PatchGraph` class that handles

```ts
const g = new PatchGraph()
g.add({type: 'p5.canvas', source: '...'})
g.add({type: ''})
```
