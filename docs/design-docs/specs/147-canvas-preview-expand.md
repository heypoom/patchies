# 147. Canvas Preview Expand

## Goal

Add a shared **Expand** action for visual objects that use `CanvasPreviewLayout`.
Expanded mode should hide the editor UI, show the selected object's render output
as the fullscreen background, and forward fullscreen pointer, touch, and wheel
input to that same object.

## Behavior

- `CanvasPreviewLayout` objects can opt into a shared Expand menu item.
- Entering expanded mode stores the previous background-output override.
- The selected node becomes the temporary background output via
  `GLSystem.setOverrideOutputNode(nodeId)`.
- `SurfaceOverlay` provides the fullscreen transparent input canvas and hides the
  editor UI through the existing `isFullscreenActive` store.
- `SurfaceListeners` normalizes pointer, touch, and wheel input from the overlay.
- `SurfaceMouseForwarder` uses its default forwarding behavior, so overlay input
  is forwarded to all eligible render nodes.
- Exiting expanded mode detaches overlay listeners, deactivates the overlay, and
  restores the previous background-output override.

## Scope

This pass covers existing render nodes that already participate in
`SurfaceMouseForwarder`: `glsl`, `swgl`, `regl`, `hydra`, `canvas`, `textmode`,
`shaderpark`, and `three`.

DOM-renderer objects that use `CanvasPreviewLayout` can still be pinned as
background output if they already upload bitmap frames through `GLSystem`, but
their DOM-specific local preview input is not moved into the overlay.

## Implementation Notes

The shared behavior should live in a small controller under `src/lib/canvas/`
rather than duplicating surface-specific code in every node component.

`surface` keeps its custom implementation because it draws directly into the
overlay canvas and exposes surface-specific JavaScript APIs such as `activate()`,
`deactivate()`, `onTouch()`, and `hideExitButton()`.

`ObjectPreviewLayout` should own the shared menu action because it already owns
background-output pinning and the overflow/context menus used by
`CanvasPreviewLayout`.

The overflow menu and context menu should share a single object-preview menu
action model. Keep Popover and ContextMenu rendering separate, but derive labels,
icons, disabled states, variants, and separator groups from one helper so adding
or changing preview actions does not require editing two independent menu trees.

## Testing

Add unit coverage for the controller:

- entering stores and replaces the current background override
- pointer and wheel events use the default forwarding rules
- exiting restores the previous override and disposes listeners/forwarder
