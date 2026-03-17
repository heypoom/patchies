The `projmap` object is a projection mapper — it warps video textures onto N-point polygon surfaces. It runs on the render worker for fast GPU-side compositing.

## Getting Started

1. Connect a video source (webcam, video, hydra, three, etc.) to one of the 4 video inlets
2. Click anywhere inside the node to start adding points to the active surface
3. Keep clicking to define the polygon shape
4. Connect the output to `bg.out` or another video node

## Point Editing

| Action | Effect |
|--------|--------|
| Click on canvas | Add point to active surface |
| Drag point | Move point |
| Hover + Delete / Backspace | Remove point |
| Click surface tab | Switch active surface |

Surfaces need at least **3 points** to render as a filled polygon. With 2 points they render as a line; 1 point is invisible.

## Expand Mode

Click the **expand button** (top-right of the node) to open a full-screen 1:1 editor. This maps the editor canvas to exactly the output resolution, making precise placement easy for actual projection setups.

Press Escape or click the shrink button to close.

## Multiple Surfaces

Use the numbered tabs in the toolbar to manage multiple surfaces. Each surface:

- Has its own set of points
- Can be assigned to a **different video inlet** via the `in X` dropdown
- Is color-coded for easy identification

To add a surface click **+**. To delete the active surface click the trash icon.

## Inlets & Outlets

- **video-in-0 to video-in-3** — up to 4 video texture sources
- **video-out-0** — composited output (all surfaces rendered together)

## See Also

- [three](/docs/objects/three) — Three.js 3D graphics
- [hydra](/docs/objects/hydra) — live coding video synthesis
- [glsl](/docs/objects/glsl) — GLSL fragment shaders
- [bg.out](/docs/objects/bg.out) — send video to the background output
