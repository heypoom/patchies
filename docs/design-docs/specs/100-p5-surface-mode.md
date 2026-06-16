# 100. P5 Surface Mode

## Goal

Allow `p5` sketches to run as transparent fullscreen performance overlays without copying their pixels into the normal video rendering chain.

## User API

P5 sketches can call `createSurfaceCanvas()` from `setup()`:

```javascript
function setup() {
  createSurfaceCanvas();
}

function draw() {
  clear();
  circle(mouseX, mouseY, 48);
}
```

`createSurfaceCanvas()` creates the p5 canvas at the current renderer output size. The user does not also call `createCanvas()`.

## Preview And Expand Behavior

- Before expansion, the node shows a scaled preview of the surface-sized p5 canvas.
- When `createSurfaceCanvas()` has run, the node menu shows **Expand**.
- Expanding activates `SurfaceOverlay`, hides the editor, and re-runs the sketch with the p5 canvas mounted into the overlay layer.
- Collapsing restores the sketch to the inline preview.
- Surface-mode p5 output is transparent by default when user code uses `clear()` or draws alpha; `background()` remains available when the sketch intentionally covers the scene.

## Rendering Contract

Surface-mode p5 is a DOM overlay presentation, not a normal render-pipeline source. It should not require Hydra-style canvas source chaining or a p5-to-GL bitmap copy for the main fullscreen overlay path.

If a secondary `/output` window is connected, frames may still be mirrored from the p5 canvas to the output window until p5 can run directly in the output context.

## Notes

- `createSurfaceCanvas(WEBGL)` should remain possible by forwarding optional renderer arguments to p5.
- The existing `p5` object remains the only object type; no `surface.p5` object is introduced.
