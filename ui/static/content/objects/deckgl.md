The `deckgl` object renders [deck.gl](https://deck.gl) layers inside the worker
video pipeline.

This is an experimental prototype. It renders deck.gl into an offscreen luma.gl
framebuffer, then blits the result into Patchies' FBO pipeline so it can connect
to `bg.out` and other video objects.

## Basic Use

Define a `getLayers()` function that returns deck.gl layers.

```js
noInteract()

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
- `TileLayer` - tiled raster/vector data, useful for OSM-style map tiles
- `viewState` - current camera state
- `setViewState(value)` - replace camera state
- `setDeckInteraction(enabled)` - enable or disable Patchies' built-in deck
  camera pan/zoom controls
- `onDeckHover(callback)` - receive deck.gl picking info when hovering over
  pickable layers
- `onDeckClick(callback)` - receive deck.gl picking info when clicking pickable
  layers
- `mouse` - forwarded mouse position

## Interaction

Drag the preview or a fullscreen `surface` to pan. Use the mouse wheel or pinch
gesture to zoom. `deckgl` disables Patchies canvas drag/pan/wheel interaction by
default so those gestures control the deck.gl view instead of moving the object.

Call `setDeckInteraction(false)` to keep the deck camera fixed unless your code
changes it with `setViewState()`.

## Picking

Set `pickable: true` on a layer, then register hover or click callbacks.
The callback receives clone-safe picking info with `object`, `index`, `x`, `y`,
`coordinate`, and lightweight `layer`/`sourceLayer`/`viewport` ids.

```js
onDeckHover(info => {
  if (info) {
    console.log('hover', info.object)
  }
})

onDeckClick(info => {
  console.log('click', info?.object)
})
```

## OSM Tiles

Use `TileLayer` with `BitmapLayer` to render OpenStreetMap raster tiles.

```js
new TileLayer({
  id: 'osm-tiles',
  data: 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
  renderSubLayers: props => {
    const [[west, south], [east, north]] = props.tile.boundingBox

    return new BitmapLayer(props, {
      data: null,
      image: props.data,
      bounds: [west, south, east, north]
    })
  }
})
```

## See Also

- [glsl](/docs/objects/glsl)
- [regl](/docs/objects/regl)
- [three](/docs/objects/three)
