# 147. DeckGL FBO Renderer

## Goal

Prototype a `deckgl` visual object that renders deck.gl layers inside the worker FBO pipeline, so deck.gl output can be chained like other video-producing objects.

## Approach

- Use deck.gl's experimental `_framebuffer` render target support.
- Attach luma.gl to the render worker's existing WebGL2 context.
- Render deck.gl into a luma-owned framebuffer and blit that framebuffer into the Patchies regl framebuffer.
- Disable deck.gl's built-in controller path and drive `viewState` from Patchies mouse and wheel forwarding.
- Keep the first prototype focused on a single video outlet and a simple layer API.

## User Code Shape

The object exposes deck.gl layer classes and expects user code to define `getLayers`.

```js
function getLayers({ time, viewState, mouse }) {
  return [
    new ScatterplotLayer({
      id: "points",
      data,
      getPosition: (d) => d.position,
      getRadius: 400,
      getFillColor: [255, 140, 40],
      pickable: true,
    }),
  ];
}
```

Raster tile layers are supported through `TileLayer` from `@deck.gl/geo-layers`
and `BitmapLayer` from `@deck.gl/layers`. The first built-in preset uses OSM
slippy-map raster tiles:

```js
function getLayers() {
  return [
    new TileLayer({
      data: "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      renderSubLayers: (props) => {
        const { boundingBox } = props.tile;
        return new BitmapLayer(props, {
          image: props.data,
          bounds: [
            boundingBox[0][0],
            boundingBox[0][1],
            boundingBox[1][0],
            boundingBox[1][1],
          ],
        });
      },
    }),
  ];
}
```

`osm-points.deckgl` extends the OSM tile pattern with a pickable
`ScatterplotLayer`, hover highlighting, click-driven color updates, and message
output for hover/click events.
`chiang-mai-hexagon.deckgl` uses `HexagonLayer` from
`@deck.gl/aggregation-layers` to render an extruded 3D heatmap over Chiang Mai.
The installed `@deck.gl/aggregation-layers@9.0.0` HexagonLayer path is
CPU-backed and renders an aggregated `ColumnLayer` sublayer, so debugging should
inspect sublayer data, picking, and GL state across frame boundaries.
`hexagon-flat.deckgl` and `column.deckgl` are diagnostic presets used to isolate
whether failures come from HexagonLayer aggregation, ColumnLayer rendering, or
extruded/depth/lighting state.

## Interaction

- Drag forwards through the existing Shadertoy-style mouse state.
- Left-drag pans longitude/latitude.
- Wheel changes zoom.
- The surface object forwards pointer and wheel input to `deckgl` the same way it does for worker `three`.
- User code can call `setDeckInteraction(false)` to disable Patchies'
  built-in deck camera pan/zoom while still rendering layers from a fixed or
  programmatically controlled `viewState`.
- User code can call `onDeckHover(callback)` and `onDeckClick(callback)` to
  receive manual picking results from forwarded mouse input. Layers must opt in
  with `pickable: true`.
- User code can call `setDeckPicking(false)` to skip Patchies' manual
  `pickObject()` pass while keeping camera interaction enabled. This is useful
  for render-only demos and for isolating whether deck.gl's picking pass is
  involved in a rendering issue.
- The worker also skips `pickObject()` when the flattened deck.gl layer tree has
  no `pickable` layers, even if hover/click callbacks are registered.
- User code can call `setDeckDebug(true)` to log throttled worker diagnostics
  for deck.gl frame stages, flattened layer ids, framebuffer size, and WebGL
  errors.
- The worker patches deck.gl v9.0 picking blend parameters into legacy WebGL
  `blendEquation`/`blendFunc` parameters because deck.gl's picking pass emits
  `blendAlphaSrcFactor: 'constant-alpha'`, which the pinned luma.gl WebGL
  adapter does not accept.
- The worker sets deck.gl `width`/`height` from Patchies'
  `renderer.outputSize` instead of relying on DOM/canvas auto-size inference.
  Worker `OffscreenCanvas` and the shared regl WebGL context do not provide the
  same reliable `clientWidth`/`clientHeight` path as a DOM canvas.

## Non-goals

- No Mapbox basemap integration in this prototype.
- No WebGPU path in this prototype.
- No production-grade picking or tooltip UI yet.
- No direct rendering into a regl-owned framebuffer until the safer luma-owned target path is proven.
