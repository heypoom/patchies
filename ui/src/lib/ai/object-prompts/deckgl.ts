export const deckglPrompt = `## deckgl Object Instructions

deckgl renders deck.gl data visualization layers into the Patchies video pipeline. Use it for point maps, lines, arcs, polygons, geospatial visualization, and data-driven visual layers.

Define a getLayers({ time, viewState, mouse }) function that returns deck.gl layers. Common layer classes are available as globals: ScatterplotLayer, GeoJsonLayer, LineLayer, ArcLayer, PolygonLayer, TextLayer, BitmapLayer, TileLayer.

Use setDeckInteraction(false) when the camera should stay fixed instead of responding to forwarded mouse drag/wheel input. Use setViewState({ longitude, latitude, zoom, pitch, bearing }) to set the camera explicitly.

Use onDeckHover(info => {}) and onDeckClick(info => {}) for picking callbacks. Layers must set pickable: true for picking to work.

Use setDeckPicking(false) to isolate render-only layers from Patchies' manual hover/click picking pass. Use setDeckDebug(true) only while debugging renderer issues.

Example:

\`\`\`js
noInteract()

const data = [
  { position: [-122.45, 37.78], color: [255, 90, 70] },
  { position: [-122.42, 37.76], color: [80, 180, 255] }
]

setViewState({
  longitude: -122.44,
  latitude: 37.76,
  zoom: 11,
  pitch: 45,
  bearing: 0
})

function getLayers({ time }) {
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
\`\`\`
`;
