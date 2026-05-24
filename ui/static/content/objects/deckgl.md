The `deckgl` object renders [deck.gl](https://deck.gl) layers inside the worker
video pipeline.

This is an experimental prototype. It renders deck.gl into an offscreen luma.gl
framebuffer, then blits the result into Patchies' FBO pipeline so it can connect
to `bg.out` and other video objects.

## Basic Use

Define a `getLayers()` function that returns deck.gl layers.

```js
const data = [
  { position: [-122.45, 37.78], color: [255, 90, 70] },
  { position: [-122.42, 37.76], color: [80, 180, 255] }
]

function getLayers({ time, viewState, mouse }) {
  return [
    new ScatterplotLayer({
      id: 'points',
      data,
      getPosition: d => d.position,
      getRadius: 500 + Math.sin(time * 2) * 100,
      getFillColor: d => d.color,
      radiusUnits: 'meters'
    })
  ]
}
```

## Available Globals

- `Deck` - deck.gl Deck class
- `ScatterplotLayer`, `GeoJsonLayer`, `LineLayer`, `ArcLayer`, `PolygonLayer`, `TextLayer`, `BitmapLayer` - common deck.gl layers
- `viewState` - current camera state
- `setViewState(value)` - replace camera state
- `mouse` - forwarded mouse position

## Interaction

Drag the preview or a fullscreen `surface` to pan. Use the mouse wheel or pinch
gesture to zoom.

## See Also

- [glsl](/docs/objects/glsl)
- [regl](/docs/objects/regl)
- [three](/docs/objects/three)
