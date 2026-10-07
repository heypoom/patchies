# Canvas Interaction

Visual objects provide methods that control mouse, touch, and arrow-key interaction with the node. By default, these interactions pass to the canvas for panning and dragging.

Use these methods when an object needs its own controls.

## Supported Objects

These objects support the interaction methods:

- `hydra`, `swgl`, `pixi`, `p5`, `canvas`, `canvas.dom`, `textmode`, and `textmode.dom`
- `three`, `three.dom`, `pixi.dom`, `regl`, `vue`, `dom`, and `surface`

## Methods

### `noDrag()`

Call `noDrag()` to stop object dragging when you click or touch inside it. Use it for sliders, buttons, or drawing.

### `noPan()`

Call `noPan()` to stop canvas panning when you drag inside the object. Use it for objects with internal drag behavior.

### `noWheel()`

Call `noWheel()` to stop wheel zoom inside the object. Use it for scrollable content or wheel controls.

### `noArrowKeyMove()`

Call `noArrowKeyMove()` to stop arrow keys from moving this object, including Shift + arrow keys. Use it when your object handles arrow keys for its own controls. Mouse dragging and keyboard callbacks still work.

```javascript
// Keep the node in place while arrow keys control the sketch.
noArrowKeyMove();
```

When multiple objects are selected, arrow keys move only objects that allow arrow-key movement. The setting resets when you run the code again.

### `noInteract()`

Call `noInteract()` to disable dragging, panning, wheel zoom, and arrow-key node movement. Use it for fully interactive objects.

## Usage

Call these methods in setup code. In P5.js, call them in `setup()`:

```javascript
function setup() {
  createCanvas(400, 400);
  noInteract(); // Reserve mouse and arrow-key interaction for the sketch
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
