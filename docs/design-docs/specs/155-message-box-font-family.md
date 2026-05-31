# 155. Message Box Font Family

The `msg` object should use the editor font family from Settings for both its
editable CodeMirror state and its collapsed click-to-send state.

## Scope

- `msg` subscribes to the shared `editorFontFamily` store.
- The collapsed message button inherits that font through a component-scoped CSS
  custom property.
- Inline highlighted fragments inside the message button inherit the same font
  instead of falling back to the browser default `code` font.

## Notes

- `CodeEditor` already applies `editorFontFamily` by default, so the change is
  focused on the message node wrapper and collapsed display styling.
- No persistence change is needed; the existing editor settings store remains
  the single source of truth.
