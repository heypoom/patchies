# 156. Keyboard Node Font Family

The `keyboard` object should use the editor font family from Settings for its
key text.

## Scope

- `keyboard` subscribes to the shared `editorFontFamily` store.
- The filtered-mode key label inherits that font through a component-scoped CSS
  custom property.
- The keybind input in the keyboard settings panel uses the same font so editing
  the displayed key matches the node label.

## Notes

- No persistence change is needed; the existing editor settings store remains
  the single source of truth.
