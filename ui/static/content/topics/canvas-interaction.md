# Canvas Interaction

Visual objects provide methods to control how mouse/touch interactions behave inside the node. By default, interactions pass through to the canvas for panning and dragging. Use these methods to capture interactions for your own UI.

## Supported Nodes

These methods are available in: `p5`, `canvas`, `canvas.dom`, `textmode`, `textmode.dom`, `three`, `three.dom`, `vue`, `dom`

## Methods

`noDrag()`

Disables dragging the object when clicking/touching inside it. Use this when you need mouse/touch interactivity like sliders, buttons, or drawing.

`noPan()`

Disables panning the canvas when dragging inside the object. Useful for objects with internal drag behavior that shouldn't move the canvas view.

`noWheel()`

Disables wheel zoom when scrolling inside the object. Useful for scrollable content or objects that respond to wheel events.

`noInteract()`

Convenience method that calls all three: `noDrag()`, `noPan()`, and `noWheel()`. Use this for fully interactive objects.

## Usage

Call these in your setup code. In P5.js, call them in `setup()`:

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

For other objects, call at the top level of your code.

## Note

You can still drag the object by its title bar even when `noDrag()` is enabled.

## See Also

- [p5](/docs/objects/p5) - P5.js sketches
- [canvas](/docs/objects/canvas) - Canvas API
- [JavaScript Runner](/docs/javascript-runner) - Full runtime reference
