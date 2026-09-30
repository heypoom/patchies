# 101. Fluid canvas.dom widgets

`canvas.dom` keeps its fixed-size behavior by default. Widgets can opt into a
fluid canvas with `setFluidSize({ showResizer?: boolean })`.

Fluid mode uses the node's dimensions as the canvas's logical drawing size.
Calls to `setCanvasSize()` made during that run do not change the dimensions
and report one warning to the node console. This makes a widget's displayed
size, its mouse coordinates, and its video bitmap use the same coordinate
space.

`onCanvasResize(callback)` registers one callback for the current execution.
It receives `{ width, height }` after a node resize. Resize work is coalesced
to one callback per animation frame; code is not re-run because widgets often
hold state and listeners.

Fluid mode exposes an XYFlow `NodeResizer`. `showResizer` controls only its
initial visibility. `resize` limits the allowed axis to `'horizontal'`,
`'vertical'`, or `'both'` (the default). `keepAspectRatio` keeps the node's
initial ratio and uses both dimensions, regardless of the axis option.
`initialSize: { width, height }` defines the default in logical canvas pixels
and applies only before the user has explicitly sized the node.

The node overflow menu provides Enable/Disable resizing, and the user's
persisted choice wins on later code runs. This is an editor control, not an
object setting.

The `dom` and `vue` objects share the same `setFluidSize` options and editor
controls. Their resize callback is named `onResize`, because it applies to an
HTML container rather than a canvas bitmap.

## Generated widget defaults

AI prompts for `canvas.dom`, inline `p5`, `pixi.dom`, `dom`, and `vue` default to fluid
sizing. Fixed sizing is used when explicitly requested or required by the
sketch; p5 fullscreen surface mode keeps its separate sizing API.

Generated code passes `showResizer: false` to `setFluidSize()` by default,
unless visible resize handles are explicitly requested. Users can enable
resizing from the node overflow menu.

Generated widgets fill the outer container without outer padding by default.
On resize, layout, typography, controls, and hit areas scale with the live
canvas dimensions. Text stays large and readable: at least 18px for labels
and 24–32px for primary text at the initial size, growing with larger widgets.
Repositioning elements alone does not satisfy responsive sizing.

`canvas.dom` recomputes sizes in its draw loop or resize callback. Inline p5
uses current `width` and `height` in `draw()`. `pixi.dom` updates layout and
UI scale in `onCanvasResize()` and runs that layout once initially. DOM and
Vue widgets use container-relative CSS or `onResize()` to update typography
and control sizes, with controls inheriting the responsive font size.

## Implementation boundary

`useFluidCanvas.svelte.ts` owns fluid-mode state, the generated-code API,
resize coalescing, node-size persistence, and the overflow action. `CanvasDom`
provides canvas-specific adapters for dimensions, errors, bitmap output, and
XYFlow rendering controls. This keeps the canvas execution lifecycle separate
from the optional fluid-layout lifecycle.
