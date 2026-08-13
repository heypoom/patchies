# 175. Sidebar Object Settings Editor

## Goal

Give settings-capable objects a persistent editor surface that does not
require locating or panning to the node on the canvas. This complements the
existing floating settings panel; it does not replace it.

## Scope

- Add a user-configurable `Settings` sidebar tab. It is hidden by default and
  can be enabled with the existing sidebar tab picker.
- The tab lists schema-backed nodes and object-specific panels that register a
  sidebar settings view. The sidebar renders settings only; it never exposes a
  node's code editor.
- The active target follows a selected settings-capable canvas node. Selecting
  a node with no settings preserves the most recently edited settings target.
- Users can choose any eligible node from the tab without selecting or moving
  that node on the canvas.
- A single pin freezes the target against later canvas selection changes. A
  deleted or ineligible pinned node clears the pin and falls back to the most
  recent eligible target.
- Reuse `ObjectSettings` so values, defaults, visibility rules, color pickers,
  and undo/redo semantics stay identical to the existing floating panel.
- Add an Editor preference, disabled by default, that opens a node's Settings
  action in the sidebar and enables the tab. Existing floating settings
  behavior remains the default.

## Interaction

The Settings tab header contains an eligible-node selector and a pin toggle.
The selector is the only way to change the sidebar target without changing the
canvas selection. The settings form scrolls within the sidebar, keeping long
schemas usable without affecting the canvas viewport.

When the patch has no eligible nodes, the tab shows a concise empty state. If
the current target disappears or loses its schema, the next available eligible
node becomes the fallback target; otherwise the empty state is shown.

## Boundaries

Schema-driven settings remain the default integration. Bespoke settings panels
can also register a live, object-specific Svelte settings view when a schema
cannot express their controls; the sequencer is the initial example.

## Architecture

Node layouts use a shared Svelte composable to register either a schema with
live callbacks or a bespoke settings view, then route an action to the floating
panel or sidebar, including the one-off Shift inversion. The sidebar owns a
second composable for selection, pinning, and explicit node-target requests.
Object layouts retain their object-specific value and revert behavior.

## Verification

- The tab is hidden for new users and can be enabled from the sidebar menu.
- Canvas selection follows into the tab unless its target is pinned.
- The selector changes the edited node without changing canvas selection.
- Pinning resists selection changes and clears safely when the node is gone.
- A settings change updates the target's node data and remains undoable.
- The preference routes Settings actions to the sidebar only when enabled; the
  default continues to open the floating panel.
- Selecting a sequencer shows its existing settings controls in the sidebar,
  and changes retain the existing node-data and undo/redo behavior.
