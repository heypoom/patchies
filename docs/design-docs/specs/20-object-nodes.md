# 20. Object Nodes

Let's create a node simply called `object` that is the most general object in a system.

Imagine most objects in Pd and Max: they do not have a specific visual interface. They would simply be a box with the name of the object inside, and optionally some parameters:

- `gain`
- `midi2freq`
- `metro`
- `osc 220`

This allows us to quickly create nodes without having to design a specific visual interface.

## Object Node States

Object nodes have two distinct states to optimize both editing and usage:

### Locked State

- **Default state** for existing nodes with content
- Allows **node dragging** for repositioning
- Displays the object name as **read-only text**
- **Double-click** to enter editing state

### Editing State

- **Text input field** is active and focused
- **Disables node dragging** (input has `nodrag` class)
- Shows **autocompletion dropdown** when typing
- **Auto-focuses** when entering editing state

### State Transitions

- **New nodes**: Start in editing state with auto-focused input
- **Double-click locked node**: Enter editing state
- **Enter key**: Exit editing state, save changes, enter locked state
- **Escape key**: Exit editing state without saving, enter locked state
- **Blur (unfocus) with empty input**: Delete the entire node
- **Blur (unfocus) with content**: Save changes and enter locked state

## Using object nodes to quickly create other visual nodes

If the name of a known visual node is specified, e.g. `bang`, `msg`, `bchrn`, it will change its data type to that node, and initiate the data with the default value of that node type.

In the future, we should allow specifying parameters that changes the default value of that node. Example: `msg 1112` would create a `msg` node with the default value of `1112`.

## Autocompletion for object nodes

There should be two autocompletions for object nodes:

- A list of known object nodes, both visual and non-visual, such as `gain`, `midi2freq`, `metro`, etc.
  - Typing `m` should show `midi2freq`, `metro`, and `msg` for example.
- Completions for parameters of the object node, such as `gain 0.5`, `midi2freq 60`, etc.
  - It should show how many parameters the object node has
  - Example: `gain [float]` or `msg [string]`

## Data structure of object nodes

In the XYFlow data structure, we should use the node type of `object`, and then in the node's data payload, we specify `name` as the name of the object, and other parameters as needed. Then, `name` becomes a restricted parameter that must be specified.

```tsx
{
  "type": "object",
  "data": {
    "name": "gain",
    "gain": 0.5,
  }
}
```

## Using object nodes to create audio nodes

Most audio nodes do not have a user interface, especially nodes that represent audio processing nodes in an audio graph. We might turn them into visual nodes later (e.g. to have visual representations for oscillators or volume sliders for dacs/gains), but for now, we use the `object` node to create them.

## Using object nodes to create expressions

In the next phase, we should support executing expressions in object nodes. This will allow us to create nodes that can execute arbitrary code, such as mathematical operations or logical conditions, without having to always write JavaScript code.

## Inlet and Outlet Definition

Each object node must have a way to define its inlets and outlets.

Each inlet and outlet can be untyped, meaning any kind of messages and signals can be sent to them.

The configuration must be data only.

Here is an example of a plain inlet without either a name or a type. In this example, Patchies just creates 3 message inlets and 1 message outlet and it does not care what messages are sent to them. The object is responsible for handling the message types, e.g. with a `typeof` type guard.

```tsx
const objectDefs = {
  clip: {
    inlets: [{}, {}, {}],
    outlets: [{}],
  },
};
```

Here is an example configuration for a node with named, yet untyped inlets and outlets:

```tsx
const objectDefs = {
  clip: {
    inlets: [
      { name: "value", description: "Value to clip" },
      { name: "min", description: "Minimum value" },
      { name: "max", description: "Maximum value" },
    ],
    outlets: [{ name: "clippedValue", description: "Clipped value" }],
  },
};
```

When an inlet or outlet is typed, type validation will be performed automatically. If the type does not match, the message will not be sent to the object. In the future, this shall log to the virtual console that the message was not sent due to type mismatch.

```tsx
const objectDefs = {
  clip: {
    inlets: [
      { name: "value", type: "float", description: "Value to clip" },
      { name: "min", type: "float", description: "Minimum value" },
      { name: "max", type: "float", description: "Maximum value" },
    ],
    outlets: [
      { name: "clippedValue", type: "float", description: "Clipped value" },
    ],
  },
};
```

One inlet can be overloaded.

## Inlet and Outlet Types

- `any`: any type of value, no type validation is performed.
- `bang`: a bang message, used to trigger events.
- `float`: a floating point number, e.g. `0.5`, `1.0`, `-2.3`.
- `int`: an integer number.
  - uses `Number.isInteger()` to validate.
- `string`: a string, e.g. `"hello"`
- `bool`: a boolean value, either `true` or `false`.
- `int[]`: an array of integers, e.g. `[1, 2, 3]`.
  - uses `list.every(Number.isInteger)` to validate.
- `float[]`: an array of floating point numbers, e.g. `[0.5, 1.0, -2.3]`.
