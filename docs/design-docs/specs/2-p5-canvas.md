# 2. P5.js Canvas

- Replace the 'canvas' component name with 'p5'.
- This component should let you write P5.js code, which should then appear in the canvas.
- It should contain a little hover button to open the code editor. code editor should float right next to the sidebar.
- Use icons from Iconify for Svelte: <https://iconify.design/docs/icon-components/svelte>
- Use the CodeJar library to create a minimal JavaScript code editorcons.

## Shape compatibility

- Run p5 v2 with the shape compatibility addon so sketches can use v1's six-argument 2D and nine-argument 3D `bezierVertex()` calls.
- Forward v2's two-argument 2D and three-argument 3D Bézier point calls to the native implementation without changing the active Bézier order. The v2 renderer uses these calls internally when drawing `bezier()`.
- Standard `bezier()` calls must draw curves without argument-count errors or requiring sketches to sample curves manually with `vertex()`.

## Compatibility module loading

- Keep the preload, shapes, and data compatibility addons as TypeScript modules under `ui/src/lib/p5/compat/`.
- Import the addons normally and register them synchronously once after importing p5, before constructing any sketch.
- Preserve the existing addon APIs and lifecycle behavior during the migration.
- Bundle the addons with the app so offline downloads do not fetch separate `/lib/p5/compat/*.js` scripts.
