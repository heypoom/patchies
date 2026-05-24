export const deckglPrompt = `## deckgl Object Instructions

deckgl renders deck.gl data visualization layers into the Patchies video pipeline. Use it for point maps, lines, arcs, polygons, geospatial visualization, and data-driven visual layers.

Define a getLayers({ time, viewState, mouse }) function that returns deck.gl layers. Common layer classes are available as globals: ScatterplotLayer, GeoJsonLayer, LineLayer, ArcLayer, PolygonLayer, TextLayer, BitmapLayer.

Example:

\`\`\`js
const data = [
  { position: [-122.45, 37.78], color: [255, 90, 70] },
  { position: [-122.42, 37.76], color: [80, 180, 255] }
]

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
