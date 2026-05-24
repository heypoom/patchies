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

The object exposes deck.gl classes and expects user code to define `getLayers`.

```js
function getLayers({ time, viewState, mouse }) {
  return [
    new ScatterplotLayer({
      id: 'points',
      data,
      getPosition: d => d.position,
      getRadius: 400,
      getFillColor: [255, 140, 40],
      pickable: true
    })
  ]
}
```

## Interaction

- Drag forwards through the existing Shadertoy-style mouse state.
- Left-drag pans longitude/latitude.
- Wheel changes zoom.
- The surface object forwards pointer and wheel input to `deckgl` the same way it does for worker `three`.

## Non-goals

- No Mapbox basemap integration in this prototype.
- No WebGPU path in this prototype.
- No production-grade picking or tooltip UI yet.
- No direct rendering into a regl-owned framebuffer until the safer luma-owned target path is proven.
