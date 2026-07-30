# Canvas Interaction

Visual objects provide methods that control mouse and touch interaction inside the node. By default, these interactions pass to the canvas for panning and dragging.

Use these methods when an object needs its own controls.

## Supported Objects

These objects support the interaction methods:

- `p5`, `canvas`, `canvas.dom`, `textmode`, and `textmode.dom`
- `three`, `three.dom`, `vue`, and `dom`

## Methods

### `noDrag()`

Call `noDrag()` to stop object dragging when you click or touch inside it. Use it for sliders, buttons, or drawing.

### `noPan()`

Call `noPan()` to stop canvas panning when you drag inside the object. Use it for objects with internal drag behavior.

### `noWheel()`

Call `noWheel()` to stop wheel zoom inside the object. Use it for scrollable content or wheel controls.

### `noInteract()`

Call `noInteract()` to disable all three default canvas interactions. Use it for fully interactive objects.

## Usage

Call these methods in setup code. In P5.js, call them in `setup()`:

```javascript
function setup() {
  createCanvas(400, 400);
  noInteract(); // Enable full mouse interactivity
}

function draw() {
  background(220);
  circle(mouseX, mouseY, 50);
}

function mousePressed() {
  // This will now work!
  console.log("Clicked at", mouseX, mouseY);
}
```

In other objects, call the methods at the top level of your code.

> **Note**: You can still drag an object by its title bar when `noDrag()` is enabled.

## See Also

- [p5](/docs/objects/p5) — Create P5.js sketches.
- [canvas](/docs/objects/canvas) — Use the Canvas API.
- [JavaScript Runner](/docs/javascript-runner) — Read the full runtime reference.
