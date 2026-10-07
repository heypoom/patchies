# 188. P5 Code Completions

## Goal

Offer the full public P5 v2 sketch API in the P5 editor, alongside Patchies runtime
helpers such as `send`, `recv`, `fft`, and `createSurfaceCanvas`.

## Behavior

- Complete drawing, typography, images, transforms, WebGL, math, DOM, input,
  loading, accessibility, utilities, storage, constants, and sketch state.
- Include lifecycle and event callbacks dispatched by `P5Manager`, including
  `preload` and touch callbacks, plus installed shape and data compatibility helpers.
- Complete constructors on `p5` and static helpers on `p5.Vector`. Do not suggest
  sketch globals on arbitrary object members. Inferring user variable types for
  instance-method completion is outside this change.
- Only activate in P5 nodes. Suppress completions in comments, strings, and embedded
  GLSL; template interpolation remains JavaScript.
- Show signatures and short descriptions in completion and hover hints.
- Generate a checked-in catalog from installed P5 v2 declarations, cross-checked
  against https://p5js.org/reference/. Do not import the browser runtime or fetch
  documentation during editor use. Exclude newer-release APIs and uninstalled addons.
- Preserve shared Patchies completions and editor feature toggles.
- Rank frequently used Patchies helpers `console.log`, `send`, and `recv` above
  matching P5 API entries, using completion boosts across JavaScript nodes.

## Verification

Test node scope, context suppression, callback insertion, namespace completion,
hover hints, and coexistence with Patchies helpers. Review coverage against the
reference and installed runtime.
