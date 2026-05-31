# 157. Peek Node Font Family

The `peek` object should use the editor font family from Settings for its
displayed value and expression editor shell.

## Scope

- `peek` subscribes to the shared `editorFontFamily` store.
- The displayed value inherits that font through a component-scoped CSS custom
  property.
- The inner `<pre>` explicitly inherits font family so browser/preflight
  monospace defaults do not override the setting.
- The expression editor wrapper uses the same font token so the collapsed value
  and expanded expression state feel consistent.

## Notes

- `CodeEditor` already applies `editorFontFamily` by default. This change keeps
  the surrounding `peek` UI aligned with that existing behavior.
- No persistence change is needed; the existing editor settings store remains
  the single source of truth.
