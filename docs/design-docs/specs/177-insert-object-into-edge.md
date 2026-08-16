# 177. Insert Object into Edge

## Problem

Adding a processing object between two connected objects currently requires creating it, deleting the
existing edge, and manually making two new connections. This makes small patch edits unnecessarily
slow.

## Behavior

When exactly one edge is selected, insertion is contextual:

- Pressing Enter opens the normal Quick Insert `ObjectNode` at the midpoint of the selected edge.
- Opening the object browser, including its toolbar and keyboard shortcuts, keeps the selected edge as
  the insertion target.
- Confirming an object or preset from either surface inserts it at that midpoint.
- Patchies finds the first compatible inlet and the first compatible outlet on the new node. If both
  exist, it replaces `Left → Right` with `Left → New → Right`.
- If either side is not compatible, Patchies leaves the original edge unchanged and inserts the node
  without connections.
- The insertion and any edge replacement are one undoable action.
- The inserted node renders above its replacement edges.
- Provisional Quick Insert edges are editor-only: they are never autosaved, and cancelling restores
  the selected edge.
- Edge midpoint calculations use canvas positions, including endpoints nested in visual groups.

Normal insertion behavior remains unchanged when zero or multiple edges are selected.

## Compatibility

Compatibility uses the same handle validation as manual wiring, including message, audio, video,
analysis, audio-parameter, and accepts-float behavior. Only schema ports that render a static handle
participate, plus object-owned dynamic ports where available; objects without a known compatible
inlet and outlet are placed without rewiring.

When an object has a companion `name>` pipe preset, inserting its base object name into a selected
edge creates that pipe preset instead. This includes `js>`, `hydra>`, `glsl>`, `regl>`, `swgl>`,
`three>`, and `tone>`. This applies equally to Object Browser cards and typed Quick Insert names.

GLSL sampler uniforms are dynamic video inlets and are derived before edge compatibility is checked.
The video pipe presets expose one video inlet and outlet when inserted into a video edge, including
when their preset data omits the default port counts.

## Verification

- Insert a message pass-through node into a selected message edge and verify the original edge is
  replaced by two message edges.
- Insert an incompatible audio-only node into that edge and verify the original edge remains.
- Verify undo restores the original edge and removes the inserted node; redo restores the insertion.
- Verify Enter Quick Insert and object-browser object and preset cards have the same behavior.
