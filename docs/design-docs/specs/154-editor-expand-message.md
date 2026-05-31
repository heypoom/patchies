# 154. Editor Expand Message

Objects with fullscreen or detached code editors should expose the same actions
through their message inlet as their toolbar Expand and Close buttons.

## Scope

- `orca` accepts `{ type: 'expand' }` and `{ type: 'collapse' }` to open and close
  the detached Orca editor.
- `strudel` accepts `{ type: 'expand' }` and `{ type: 'collapse' }` to open and
  close the detached Strudel editor.
- `bytebeat~`, `chuck~`, and `csound~` accept `{ type: 'expand' }` and
  `{ type: 'collapse' }` to open and close the shared fullscreen CodeMirror
  overlay for their expression editor.
- `surface` uses the shared common schemas for its existing `expand` and
  `collapse` messages.
- Existing play, stop, run, code-update, and forwarded object-specific messages
  remain unchanged.

## Implementation Notes

- Add `expand` and `collapse` TypeBox schemas to common messages.
- Add pre-wrapped `expand` and `collapse` matchers for each object's
  `handleMessage` path.
- For expression-backed objects, call `layoutRef?.openExpandedEditor()`.
- For expression-backed object collapse, call `layoutRef?.closeExpandedEditor()`.
- For `chuck~`, match `expand` and `collapse` before the generic typed-message
  fallback.
