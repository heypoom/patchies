# 143. CodeMirror Completion Hover Hints

## Goal

Show lightweight hover hints for single-token functions and values in CodeMirror using the same metadata as autocomplete.

## Initial Scope

- Hovering a global Patchies JavaScript API name such as `send` should show its autocomplete label, signature/detail, and description.
- Hovering a Shader Park Sculpt global such as `sin`, `sphere`, or `time` should show the Shader Park autocomplete metadata in `shaderpark` nodes.
- Hovering GLSL names such as `sin`, `length`, `uv`, or `iTime` should show GLSL autocomplete metadata in GLSL editors and recognized GLSL-in-JS template strings.
- Normal JavaScript strings should not show Patchies or Shader Park hover hints.
- Line comments (`//`) and block comments (`/* ... */`) should not show hover hints.
- Template-string interpolation bodies (`${...}`) should remain JavaScript hover contexts.
- Hover tooltip content should keep a readable minimum width even when the code editor node is narrow, while still fitting within small viewports.
- Users can disable completion hover hints from the Settings modal's Editor section. The setting is enabled by default and should reconfigure existing CodeMirror editors without a page reload.

## Related Settings

- Users can also disable autocomplete from the Settings modal's Editor section. The setting is enabled by default and should remove CodeMirror autocomplete sources and completion UI from existing editors without disabling syntax highlighting or other language support.

## Out Of Scope

- Member hovers such as `kv.get`, `settings.define`, or `clock.time`.
- Type inference or local symbol documentation.
- Hover hints for snippets that are not represented by a single hovered token.
