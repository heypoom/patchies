The `projmap` object is a projection mapper — it warps video textures onto
N-point polygon surfaces. It runs on the render worker for GPU compositing.

## Getting Started

1. Connect a video source to a video inlet
2. Click inside the node to add points to the active surface
3. Keep clicking to define the polygon shape
4. Connect the output to `bg.out` or another video node

## Editing Modes

Toggle with the **pen / pointer button**, the context menu, or press **M**
while hovering over the canvas.

| Mode | Behaviour |
| --- | --- |
| **Add** (pen) | Click to add points; drag to move them |
| **Move** (pointer) | Drag an entire surface to reposition it |

## Point Editing (Add mode)

| Action | Effect |
| --- | --- |
| Click on canvas | Add point to active surface |
| Click near an edge | Insert point between nearest endpoints |
| Drag point | Move point |
| Hover + Delete / Backspace | Remove hovered point |
| Click inside inactive surface | Switch to that surface |

Surfaces need at least **3 points** to render as a filled polygon. With 2
points they render as a line; 1 point is invisible.

## Surface Management

Use the numbered tabs to switch the active surface. Each surface has its own
points and a dedicated video inlet — inlets are added and removed
automatically as surfaces are added or deleted.

Right-click on the canvas or use the **⋯** overflow menu to add or delete
surfaces. Deleting the last surface clears its points instead.

## Expand Mode

Open via **Expand editor** in the overflow or context menu. The canvas maps
exactly to the output resolution for precise physical projection setups.

| Shortcut | Action |
| --- | --- |
| Escape | Close expanded editor |
| M | Toggle add / move mode (when hovering canvas) |

## Keyboard Shortcuts (default view)

| Shortcut | Action |
| --- | --- |
| M | Toggle add / move mode (when hovering canvas) |
| Delete / Backspace | Remove hovered point (add mode) |
| Delete / Backspace | Delete active surface (move mode) |

## Inlets & Outlets

- **video-in-N** — one inlet per surface (added/removed automatically)
- **video-out-0** — composited output (all surfaces rendered together)

## See Also

- [three](/docs/objects/three) — Three.js 3D graphics
- [hydra](/docs/objects/hydra) — live coding video synthesis
- [glsl](/docs/objects/glsl) — GLSL fragment shaders
- [bg.out](/docs/objects/bg.out) — send video to the background output
