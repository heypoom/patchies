# 146. Touch To Mouse Forwarding

Single-touch input on touch devices should drive the same mouse interaction paths
already used by `shaderpark`, `surface`, and worker `three`.

## Goals

- Treat the primary touch point as a left-button mouse drag.
- Reuse existing render-worker mouse state and surface mouse forwarding paths.
- Keep the existing `surface` `onTouch()` API for richer touch-specific patches.
- Leave pinch-to-wheel zoom as the immediate next step.

## Behavior

For node previews and active surfaces:

- `touchstart` forwards a mouse-style `down` event with `buttons: 1`.
- `touchmove` forwards a mouse-style `move` event with `buttons: 1`.
- `touchend` and `touchcancel` forward a mouse-style `up` event at the last
  primary touch position with `buttons: 0`.
- Only the first active touch is used for mouse emulation.
- Multi-touch data continues to be available through `surface` `onTouch()`.

## Scope

This pass covers single-touch drag only. Pinch gestures should be implemented in
a follow-up by translating two-touch distance changes into the existing wheel
paths:

- worker `three`: `sendThreeWheelData`
- Shader Park 3D: `zoomShaderParkOrbit`

## Implementation Notes

The conversion should live in shared input plumbing rather than in individual
render nodes. `shaderpark` and worker `three` already consume mouse state through
`GLSystem.setMouseData`, while `surface` already forwards pointer events through
`SurfaceMouseForwarder`.

