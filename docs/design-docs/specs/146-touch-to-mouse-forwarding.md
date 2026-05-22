# 146. Touch To Mouse Forwarding

Touch input on touch devices should drive the same mouse and wheel interaction
paths already used by `shaderpark`, `surface`, and worker `three`.

## Goals

- Treat the primary touch point as a left-button mouse drag.
- Treat two-finger pinch distance changes as wheel input.
- Reuse existing render-worker mouse state and surface mouse forwarding paths.
- Keep the existing `surface` `onTouch()` API for richer touch-specific patches.

## Behavior

For node previews and active surfaces:

- A first `touchstart` waits briefly before forwarding a mouse-style `down`
  event with `buttons: 1`, so an immediately-following second touch can become
  a clean pinch gesture.
- A one-finger `touchmove` flushes the pending mouse-style `down` immediately
  before forwarding `move`, keeping normal drag responsive.
- `touchmove` forwards a mouse-style `move` event with `buttons: 1`.
- `touchend` and `touchcancel` forward a mouse-style `up` event at the last
  primary touch position with `buttons: 0`.
- Only the first active touch is used for mouse emulation.
- When a second touch joins an active one-finger drag, the drag is cancelled
  with a mouse-style `up` event before pinch handling starts.
- Two active touches suppress mouse-drag forwarding and emit synthetic wheel
  events from the pinch center.
- After a pinch starts, single-touch mouse emulation does not resume until all
  touches are lifted.
- Pinch out maps to negative `deltaY`, matching wheel-up zoom-in behavior.
- Pinch in maps to positive `deltaY`, matching wheel-down zoom-out behavior.
- Multi-touch data continues to be available through `surface` `onTouch()`.

## Scope

This pass covers single-touch drag and two-finger pinch-to-wheel. Pinch uses the
existing wheel paths:

- worker `three`: `sendThreeWheelData`
- Shader Park 3D: `zoomShaderParkOrbit`

## Implementation Notes

The conversion should live in shared input plumbing rather than in individual
render nodes. `shaderpark` and worker `three` already consume mouse state through
`GLSystem.setMouseData`, while `surface` already forwards pointer events through
`SurfaceMouseForwarder`.
