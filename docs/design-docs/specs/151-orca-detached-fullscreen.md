# 151. Orca Detached Fullscreen

## Goal

Add an **Expand** action to the `orca` object so its live grid editor can move
into a fullscreen overlay without creating a second Orca runtime.

Orca is an interactive DOM/canvas editor, not a render-graph preview. The
fullscreen path should therefore portal the existing Orca wrapper into
`document.body`, preserving the current `Orca`, `Clock`, `IO`, renderer, cursor,
selection, and playback state.

## Behavior

- Orca shows an Expand button alongside its existing play and settings controls.
- Opening fullscreen stores the active Orca node id in session UI state.
- Only one Orca fullscreen editor is active at a time.
- The same canvas wrapper is portaled to `document.body`; no duplicate Orca
  engine or canvas is mounted.
- Fullscreen mode sets `isFullscreenActive` so the regular `SvelteFlow` canvas
  and side panels hide behind the overlay.
- The sidebar closes when Orca enters fullscreen.
- `Shift+Esc` closes fullscreen mode.
- Destroying the active Orca node clears the fullscreen state.
- Pointer coordinate math treats the portaled fullscreen canvas as unscaled DOM,
  while the inline canvas continues to account for the current XYFlow zoom.
- Fullscreen mode defaults to a `2.7x` Orca font scale so the grid is readable
  for an audience.
- The fullscreen overlay background uses the same transparency setting as
  fullscreen CodeMirror overlays, with black as its base color.
- The fullscreen Orca canvas clears its own black background so background
  visuals show through the overlay and the grid area does not become darker than
  the rest of the screen.
- The fullscreen canvas is borderless; the grid itself should be the visual
  focus.
- The fullscreen chrome includes play/pause, settings, and close controls.
- Settings render inside the fullscreen wrapper, anchored under the fullscreen
  settings button, so they remain visible while the main editor UI is hidden.

## Non-Goals

- Do not render Orca through `SurfaceOverlay`; that path is for render-graph
  previews and output canvases.
- Do not mirror the live Orca editor into `/output` in this pass.
- Do not convert Orca settings to schema-driven `ObjectSettings`; the existing
  `OrcaSettings` component remains the source for Orca-specific settings UI.

## Implementation Notes

Use the existing generic `portal` action, following the Strudel detached editor
shape. The fullscreen wrapper should be the owner of Orca's canvas and settings
panel so moving it does not orphan controls inside a hidden `SvelteFlow` tree.

Mouse coordinate conversion should use a small helper:

```ts
screenToOrcaGridCell({
  clientX,
  clientY,
  rect,
  zoom: isDetached ? 1 : viewport.current.zoom,
  tileWidth,
  tileHeight
})
```

This keeps the XYFlow zoom adjustment in inline mode and removes it once the
canvas has been portaled outside XYFlow's transformed coordinate space.

## Testing

- Unit test the detached Orca store helpers.
- Unit test the pointer coordinate helper for inline zoomed and fullscreen
  unscaled coordinates.
- Run Svelte/TypeScript checks after wiring the component.
