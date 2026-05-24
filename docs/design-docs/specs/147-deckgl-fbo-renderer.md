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
- The worker patches deck.gl v9.0 picking blend parameters into legacy WebGL
  `blendEquation`/`blendFunc` parameters because deck.gl's picking pass emits
  `blendAlphaSrcFactor: 'constant-alpha'`, which the pinned luma.gl WebGL
  adapter does not accept.

## Non-goals

- No Mapbox basemap integration in this prototype.
- No WebGPU path in this prototype.
- No production-grade picking or tooltip UI yet.
- No direct rendering into a regl-owned framebuffer until the safer luma-owned target path is proven.
