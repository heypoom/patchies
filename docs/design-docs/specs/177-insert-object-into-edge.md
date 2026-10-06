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
- Provisional Quick Insert edges are editor-only: they are never autosaved. The original edge stays
  active for audio, video, and messages while its editor rendering is hidden by the preview.
  Cancelling restores its rendering; only confirmation can replace the live route.
- Before confirming a Quick Insert object, retire its provisional edges by hiding them and routing
  their editor endpoints back to the original edge. This removes references to generic placeholder
  handles before the node changes type. Keep the preview markers until final rewiring so routing
  ignores them and autosave remains paused throughout confirmation.
- Unconfirmed ObjectNodes retain their generic inlet and outlet while typing; runtime metadata
  must not replace those handles until the expression is committed.
- Quick Insert autocomplete shows only objects and presets with compatible ports on both ends,
  including companion pipe presets and dynamic ports. Filtering happens before the result limit.
- Enter on an explicitly typed incompatible object or preset overrides autocomplete and places it
  without connections, preserving the original edge.
- Edge midpoint calculations use canvas positions, including endpoints nested in visual groups.
- Edge styling resolves current endpoint IDs and tolerates missing nodes during insertion or history
  updates. Missing endpoints use audio/video handle prefixes for color, falling back to message
  styling when the handles provide no signal type.

Normal insertion behavior remains unchanged when zero or multiple edges are selected.

## Compatibility

Compatibility uses the same handle validation as manual wiring, including message, audio, video,
analysis, audio-parameter, and accepts-float behavior. Only schema ports that render a static handle
participate, plus object-owned dynamic ports where available; objects without a known compatible
inlet and outlet are placed without rewiring.

When an object has a companion `name>` pipe preset, inserting its base object name into a selected
edge creates that pipe preset instead. This includes `js>`, `hydra>`, `glsl>`, `regl>`, `swgl>`,
`three>`, and `tone>`. This applies equally to Object Browser cards and typed Quick Insert names.

On message edges, both `js` and `js>` insert the `js>` message pass-through preset. Compatibility
uses its dynamic message port counts (one inlet and outlet by default), with `in-0` and `out-0`
as the first handles. Explicit zero port counts remain incompatible. Resolve companion pipe presets
before Quick Insert transforms the placeholder into a visual node. In particular, `js>` starts with
its console collapsed on the first render, so midpoint positioning uses the collapsed node size.

GLSL sampler uniforms are dynamic video inlets and are derived before edge compatibility is checked.
The video pipe presets expose one video inlet and outlet when inserted into a video edge, including
when their preset data omits the default port counts.

## Verification

- Insert a message pass-through node into a selected message edge and verify the original edge is
  replaced by two message edges.
- Insert an incompatible audio-only node into that edge and verify the original edge remains.
- Verify undo restores the original edge and removes the inserted node; redo restores the insertion.
- Verify repeated undo/redo restores the GLSL sampler input and rendered output without a reload.
  Render graph change detection must update both node and edge hashes on each check, including
  when a newly mounted shader forces a renderer rebuild.
- Verify Enter Quick Insert and object-browser object and preset cards have the same behavior.

## Implementation Boundary

`use-edge-insertion.svelte.ts` owns the provisional splice state, preset preparation, final
compatibility rewiring, and insertion history. `FlowCanvasInner.svelte` only supplies user events,
selected-edge IDs, and fallback positions.

`useObjectSuggestions.svelte.ts` owns reactive autocomplete, contextual compatibility filtering,
disabled-object suggestions, and the explicit Enter override. `ObjectNode.svelte` supplies reactive
getters and renders the results. Pure candidate preparation stays in `edge-insertion-suggestions.ts`.
