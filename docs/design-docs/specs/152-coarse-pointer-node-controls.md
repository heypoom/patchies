# 152. Coarse Pointer Node Controls

## Objective

Floating node controls should remain visible on coarse-pointer devices, including tablets with viewports wider than the mobile breakpoint.

## Behavior

- Mouse and trackpad layouts keep the existing hover-reveal behavior on larger viewports.
- Coarse-pointer layouts force floating node controls visible, because hover is unavailable or unreliable.
- The decision must be based on pointer capability, not viewport width alone.

## Implementation

- Use the existing `pointer-coarse` Tailwind variant from `ui/src/app.css`.
- Use shared `node-floating-button` and `node-floating-controls` component classes so coarse-pointer visibility behavior has one source of truth.
- For controls currently hidden with `sm:opacity-0`, include `pointer-coarse:!opacity-100` through those shared classes so tablet-sized touch devices do not lose access to node actions.
