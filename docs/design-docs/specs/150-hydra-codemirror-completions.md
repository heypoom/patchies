# 150. Hydra CodeMirror Completions

Hydra code editors should offer Hydra-specific autocomplete entries in addition
to the existing Patchies JavaScript runtime helpers.

## Requirements

- Completion entries should appear only for `hydra` object code.
- Source generators such as `src`, `osc`, `gradient`, `shape`, `voronoi`,
  `noise`, and `solid` should be suggested at statement starts and expression
  positions.
- Hydra-specific runtime helpers such as `datamosh` should be suggested with
  their full Patchies-specific signatures.
- Chain methods such as `diff`, `luma`, `layer`, and `out` should only be
  suggested when completing a member after a dot, such as `osc().lu`.
- Dynamic source and output globals such as `s0` and `o0` should not be
  suggested because they crowd the completion list.
- Completion metadata should include short descriptions and signatures so the
  shared completion hover hints can explain Hydra globals.
- Descriptions should explain what the transform does visually or at runtime,
  not that the editor entry was generated from transform definitions.
- Completion data should be derived from the vendored Hydra transform
  definitions where possible, so new built-in transforms do not require
  duplicated editor metadata.
- Completions should not appear inside plain JavaScript strings or comments.
- GLSL-in-JS completions should continue to take precedence inside recognized
  Hydra `setFunction({ glsl: `...` })` template strings.

## Implementation Notes

- Keep Hydra completions in a separate CodeMirror module, similar to
  Shader Park completions.
- Register the Hydra source alongside the existing JavaScript override sources
  in `language.ts`.
- Route completion hover lookup through the same Hydra metadata source.
