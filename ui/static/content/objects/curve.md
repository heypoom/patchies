Maps X inputs to Y outputs.

Draw a piecewise function by placing points on a 2D canvas,
then query it by sending an X value to get the corresponding
Y value.

## Usage

Connect a value source (e.g. `slider`, `metro + expr`) to the
inlet to query the function. The outlet outputs the interpolated
Y value at that X position.

## Interactions

| Action | Effect |
| --- | --- |
| Click on background | Add a new breakpoint |
| Drag a point | Move it (X-axis endpoints stay locked) |
| Hover a point → click ✕ | Delete it (endpoints cannot be deleted) |
| `Delete` / `Backspace` / `x` while hovering | Delete hovered point |
| Reset (settings panel) | Restore flat horizontal line at y=0.5 |

## Display Modes

Switch between modes in the settings panel (gear icon):

- **linear** — straight line segments between breakpoints
- **curve** — smooth Catmull-Rom spline passing through all breakpoints

## See Also

- `slider` — send 0–1 values to query the function
- `expr` — compute expressions on the output Y value
- `line~` — for smooth audio-rate interpolation
