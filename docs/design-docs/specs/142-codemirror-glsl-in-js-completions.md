# 142. CodeMirror GLSL-in-JS Completions

## Goal

Improve completions for JavaScript-based visual objects that embed GLSL source in strings, including `hydra`, `shaderpark`, `swgl`, `regl`, and other nodes that use the shared GLSL-in-JS parser wrapper.

## Behavior

- Patchies JavaScript runtime completions must not appear inside string literals or template-string text.
- Shader Park Sculpt completions must not appear inside string literals or template-string text.
- When the cursor is inside a template string that `glsl-in-js.ts` recognizes as GLSL, the editor should offer GLSL completions instead of JavaScript runtime completions.
- GLSL completions should work for the same contexts as GLSL-in-JS highlighting:
  - `glsl\`...\`` tagged templates.
  - Shader Park helpers: `glslFunc(...)`, `glslFuncES3(...)`, and `glslSDF(...)`.
  - Object properties used as shader bodies: `frag`, `vert`, `glsl`, `FP`, and `VP`.
- Template-string interpolation bodies (`${...}`) remain JavaScript contexts, so JavaScript completions may appear there and GLSL completions should not.

## Notes

Completion context should reuse the existing GLSL-in-JS detection rules rather than duplicating ad hoc node-specific checks.
