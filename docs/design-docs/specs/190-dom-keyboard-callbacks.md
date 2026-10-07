# 190. DOM Keyboard Callbacks

## Goal

Expose `onKeyDown(callback)` and `onKeyUp(callback)` consistently in `dom`, `vue`, `canvas.dom`, `textmode.dom`, `three.dom`, `pixi.dom`, and `surface`.

## Behavior

- Reuse the shared `useKeyboardCallbacks` helper already used by canvas-backed objects and `surface`.
- For `dom` and `vue`, listen on the preview container so focused controls inside the shadow DOM also deliver bubbling keyboard events.
- Make the preview focusable for widgets without focusable controls. Expanded previews focus an existing control when available and otherwise focus the preview.
- Pass the native `KeyboardEvent` to the registered callback. Stop propagation only when a callback is registered, preserving native control behavior and preventing handled events from reaching editor shortcuts.
- Replace the previous callback when registering another callback of the same kind. Clear callbacks on rerun, detach listeners when the preview changes or unmounts, and report callback errors through the node console.
- Keep the existing canvas-focused and surface document-level event scopes.
- Include all seven node types in keyboard API completions and document the DOM/Vue API.

## Verification

Test completion availability across all seven nodes and shared callback dispatch, replacement, propagation, reset, error reporting, and listener cleanup. Run targeted lint and Svelte checks.
