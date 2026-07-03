# 166. Hide Border

## Goal

Let JS-authored UI nodes opt out of Patchies preview border/chrome when the node should visually blend into its own interface.

## API

Expose `hideBorder()` in `dom`, `vue`, `p5`, `canvas.dom`, and `three.dom` JavaScript contexts.

Calling it persists `hideBorder: true` on the node data. The node remains selected, movable, deletable, and editable through existing canvas behavior, but Patchies stops drawing preview border/chrome for that node in both idle and selected states.

Each run starts by restoring `hideBorder: false`. If user code still calls
`hideBorder()`, the flag is set again during that run. Removing the call and
running the node restores the default border/chrome.

## Behavior

- Hide idle border, selected border, ring, glow, and hover glow on the preview surface.
- Keep the title and floating preview action controls visible, since the title is often the explicit drag handle.
- Restore default border/chrome on the next run when user code no longer calls `hideBorder()`.
- Keep port handles visible. Port visibility already has separate controls such as `setHidePorts(true)` where supported.
- Error styling still overrides hidden border chrome so runtime errors stay visible.

## Implementation Notes

- Add a small shared presentation helper for border chrome class decisions.
- Thread the persisted flag through `DomRuntimeNode`, `P5CanvasNode`, and `CanvasPreviewLayout`.
- Add `hideBorder()` to the relevant runtime contexts and CodeMirror completions.
- Document the helper in the four object docs.
