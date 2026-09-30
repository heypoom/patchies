# 166. Hide Border

## Goal

Let JS-authored UI nodes opt out of Patchies preview border/chrome when the node should visually blend into its own interface.

## API

Expose `noBorder()` in `dom`, `vue`, `p5`, `canvas.dom`, `three.dom`, and `pixi.dom` JavaScript contexts.

Calling it persists `noBorder: true` on the node data. The node remains selected, movable, deletable, and editable through existing canvas behavior, but Patchies stops drawing preview border/chrome for that node in both idle and selected states.

Each run starts by restoring `noBorder: false`. If user code still calls
`noBorder()`, the flag is set again during that run. Removing the call and
running the node restores the default border/chrome.

## Behavior

- Hide idle border, selected border, ring, glow, and hover glow on the preview surface.
- Keep the title and floating preview action controls visible, since the title is often the explicit drag handle.
- Restore default border/chrome on the next run when user code no longer calls `noBorder()`.
- Keep port handles visible. Port visibility already has separate controls such as `setHidePorts(true)` where supported.
- Error styling still overrides hidden border chrome so runtime errors stay visible.

## Implementation Notes

- Add a small shared presentation helper for border chrome class decisions.
- Thread the persisted flag through `DomRuntimeNode`, `P5CanvasNode`, and `CanvasPreviewLayout`.
- Add `noBorder()` to the relevant runtime contexts and CodeMirror completions.
- Document the helper in the object docs.

## Custom Selection Styling

Expose `onSelectionChange(callback)` in the same six JavaScript contexts.
The callback receives a boolean indicating whether the node is selected in the
patch canvas, including multi-selection. This is separate from keyboard focus
inside the widget.

- Invoke the callback immediately on registration with the current selection.
- Invoke it again only when selection changes, including deselection.
- Return an unsubscribe function; allow multiple independent subscriptions.
- Clear subscriptions when code runs again or the node is destroyed.
- Report synchronous callback errors and rejected promises through the node's
  existing runtime error reporting, without preventing other subscribers.
- Keep subscriptions working with or without `noBorder()`.
- Do not persist callbacks or selection in node data.

Use `noBorder()` with `onSelectionChange()` when user code owns selection styling.
This lets rounded widgets, inset borders, and canvas drawings match their own
geometry and theme without Patchies prescribing border colors or radius.

```js
noBorder();

root.innerHTML = '<div class="calculator">Calculator</div>';

const calculator = root.querySelector(".calculator");

Object.assign(calculator.style, {
  border: "2px solid",
  borderRadius: "16px",
  padding: "4px 16px",
});

onSelectionChange((selected) => {
  calculator.style.borderColor = selected ? "#a78bfa" : "#27272a";
});
```

Add CodeMirror completions, object documentation, and prompt guidance across all
six objects. Prompts should recommend a visible themed selection indicator when
using `noBorder()`, and tell canvas objects to retain the boolean for their next
frame or redraw.


### Selection Composable

Use `useSelectionChange({ getSelected, onError })` in the preview components.
The composable owns the selection effect, untracked callback execution, and
subscription cleanup on destruction. It returns `onSelectionChange` for the
JavaScript context and `reset` for clearing subscriptions before each run.
Keep subscription behavior in `SelectionChangeController` so it can be tested
independently of Svelte.
