# 153. Node Title Drag Cursors

Node title labels, such as `glsl`, `strudel`, `midi.in`, and `serial`, are commonly used as the easiest drag target for moving objects on the canvas.

## Requirement

- Floating node title labels should show a grab cursor on hover.
- While pressing on a title label, the cursor should switch to grabbing.
- This is only a cursor affordance. It must not change node dragging behavior or add new interactive controls.

## Implementation

- Apply the cursor affordance to the shared title-label class pattern used by specialized node components.
- Keep title text selectable behavior disabled so dragging the label does not accidentally select the label text.
