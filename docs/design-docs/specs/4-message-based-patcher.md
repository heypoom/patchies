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
  - If the type of the inlet and outlet is `video`, it will use a separate [Visual Chaining](7-visual-chaining.md) system to route video sources. In that specific case, the inlet and outlet will not be used for message passing, but rather for video source routing.

- **Props** are key-value pairs that defines the setting of an object.

  - They can be updated dynamically via messages.
  - They can be set manually.

## Simple Use Case

This demo shows how to create a generator that sends either a red or green color randomly every half a second, and a p5.js canvas that draws a circle with the received color.

Graph layout: two nodes connected: `js -> p5`.

JS block:

```js
interval(() => {
  send(Math.random() > 0.5 ? '#ff0000' : '#00ff00')
}, 500)
```

P5 canvas block:

```js
let color = '#ff0000'

onMessage((m) => {
  color = m.data
})

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

These constructs are exposed to JavaScript-based objects, such as `js`, `p5` and `hydra`.

- `send(data)` - Sends a message with the given data to all connected outlets.
  - `send(data, {outlet: 'name'})` - send to a specific named outlet.
- `onMessage(callback: (message) => void)` - Registers a callback that is called when a new message arrives.
  - The message object contains: `{data, type?, timestamp, source, inlet?}`
- `interval(callback: () => void, ms: number)` - Calls the callback every `ms` milliseconds. Does automatic cleanup when the object is unloaded. Use this instead of `setInterval` to avoid memory leaks.

## Implementation Plan

### Phase 1: Core Infrastructure

#### Message Data Structure

```js
interface Message {
  data: any; // The actual payload
  type?: string; // Optional type annotation
  timestamp: number; // For ordering/debugging
  source: string; // Source node ID
  outlet?: string; // Source outlet name
  inlet?: string; // Target inlet name (set by router)
}
```

#### Architecture Decisions

1. **Message Queues**: Each node maintains its own message queue for incoming messages.
2. **Graph Routing**: Transform XY Flow's visual edges into a message routing graph. This maintains single source of truth while allowing message routing logic.
3. **Execution Context**: Inject message constructs (`send`, `onMessage`, `interval`) into all JavaScript node execution contexts.
4. **Timing**:
   - Messages processed immediately when received
   - Global scheduler for `interval` function
   - Automatic cleanup when nodes are deleted
5. **Error Handling**:
   - Messages to disconnected outlets are ignored
   - `onMessage` callback errors shown visually on the node
   - `send` becomes no-op if node is deleted

#### Core Components

1. **MessageSystem** - Central coordinator

   - Tracks node connections from XY Flow graph
   - Routes messages between nodes
   - Manages global scheduler for intervals
   - Handles cleanup

2. **MessageQueue** - Per-node message processing

   - Queues incoming messages
   - Processes messages immediately
   - Calls `onMessage` callbacks

3. **MessageContext** - Injected into JS execution
   - `send(data, options?)` function
   - `onMessage(callback)` registration
   - `interval(callback, ms)` with auto-cleanup

### Phase 2: Integration

1. **Update existing JS nodes**:

   - `js` (JSBlockNode)
   - `p5` (P5CanvasNode)
   - `hydra` (HydraNode)
   - `canvas` (JSCanvasNode)
   - `glsl` (GLSLCanvasNode - receive only)

2. **FlowCanvas integration**:
   - Listen to XY Flow edge changes
   - Update message routing graph
   - Handle node deletion cleanup

### Phase 3: Testing

1. Implement the simple use case:

   - JS node with `interval` and `send`
   - P5 canvas with `onMessage`
   - Connected with XY Flow edge

2. Test edge cases:
   - Multiple connections
   - Rapid message bursts
   - Node deletion during message processing
   - Error handling in callbacks

### Future Enhancements

- Multiple named inlets/outlets per node
- Message type validation
- Message throttling/rate limiting
- Visual indicators for message flow
- Message debugging/logging tools
