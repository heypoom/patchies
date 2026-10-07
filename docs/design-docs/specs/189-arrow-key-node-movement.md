# 189. Arrow Key Node Movement

## Goal

Let visual JavaScript objects use arrow keys without moving their XYFlow node.

## API

- `noArrowKeyMove()` disables arrow-key movement of this node, including Shift + arrow keys.
- `noInteract()` disables drag, pan, wheel zoom, and arrow-key node movement.
- Support every runtime that provides `noDrag()`, including P5, worker-backed renderers, and DOM-backed visual objects.
- Keep pointer dragging, node selection, focus, and user keyboard callbacks available when only `noArrowKeyMove()` is called.
- Reset the setting when code runs again and clear it when the object unmounts. It is runtime state, not saved node data.
- In a multi-selection, arrow keys move only nodes that allow arrow-key movement.

## Implementation

Share interaction state and API plumbing in a node composable. Worker renderers send an `arrowKeyMove` interaction update through the existing event bus.

Install a flow-scoped adapter around XYFlow's `moveSelectedNodes`. During this synchronous call, temporarily exclude disabled nodes through the internal draggable flag and restore it in `finally`. This covers both focused nodes and the multi-selection overlay without intercepting keyboard events or changing saved node data or pointer dragging.

Document the API in Canvas Interaction, add editor completions for every supported object, and update object AI prompts.

## Verification

Test independent interaction flags, the `noInteract()` bundle, reset and cleanup, mixed-selection movement, Shift movement factors, and editor completion availability. Verify against the installed XYFlow movement implementation and run Svelte/type checks.
