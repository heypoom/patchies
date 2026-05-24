const OSM_TILES_DECKGL = `noInteract()

setTitle('OSM Tiles')
setViewState({
  longitude: -122.44,
  latitude: 37.76,
  zoom: 11,
  pitch: 0,
  bearing: 0
})

function getTileBounds(tile) {
  if (tile.boundingBox) {
    const [[west, south], [east, north]] = tile.boundingBox
    return [west, south, east, north]
  }

  const { west, south, east, north } = tile.bbox
  return [west, south, east, north]
}

function getLayers() {
  return [
    new TileLayer({
      id: 'osm-tiles',
      data: 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: getTileBounds(props.tile)
      })
    })
  ]
}`;

const OSM_POINTS_DECKGL = `setTitle('Interactive OSM Points')
setPortCount(1, 1)

let hoveredIndex = -1
let updateVersion = 0

setViewState({
  longitude: 98.9853,
  latitude: 18.7883,
  zoom: 13,
  pitch: 0,
  bearing: 0
})

function hslToRgb(h, s, l) {
  s /= 100
  l /= 100

  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))

  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))]
}

const points = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  position: [
    98.9853 + (Math.random() - 0.5) * 0.04,
    18.7883 + (Math.random() - 0.5) * 0.04
  ],
  h: 210 + Math.random() * 40,
  s: 80,
  l: 60,
  size: 50 + Math.random() * 50
}))

onDeckClick(info => {
  if (info && info.index !== -1) {
    const targetPoint = points[info.index]

    if (targetPoint) {
      targetPoint.h = (targetPoint.h + 45) % 360

      updateVersion++

      send({
        type: 'click',
        id: targetPoint.id,
        newHue: targetPoint.h,
        updateVersion
      })
    }
  }
})

onDeckHover(info => {
  if (!info) {
    hoveredIndex = -1
    return
  }

  hoveredIndex = info.index !== undefined ? info.index : -1

  if (hoveredIndex !== -1) {
    send({ type: 'hover', index: hoveredIndex, id: info.object?.id })
  }
})

function getTileBounds(tile) {
  if (tile.boundingBox) {
    const [[west, south], [east, north]] = tile.boundingBox

    return [west, south, east, north]
  }

  const { west, south, east, north } = tile.bbox

  return [west, south, east, north]
}

function getLayers({ time }) {
  const tile = new TileLayer({
    id: 'osm-tiles',
    data: 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => new BitmapLayer(props, {
      data: null,
      image: props.data,
      bounds: getTileBounds(props.tile)
    })
  })

  const scatterplot = new ScatterplotLayer({
    id: 'points-layer',
    data: points,
    getPosition: d => d.position,
    getFillColor: (d, { index }) => {
      const lightness = index === hoveredIndex ? d.l + 25 : d.l

      return hslToRgb(d.h, d.s, lightness)
    },
    getRadius: d => d.size + Math.sin(time * 2 + d.id) * 20,
    radiusUnits: 'meters',
    stroked: true,
    getLineColor: [255, 255, 255],
    getLineWidth: 2,
    lineWidthUnits: 'pixels',
    opacity: 0.9,
    pickable: true,
    updateTriggers: { getFillColor: [hoveredIndex, updateVersion] }
  })

  return [tile, scatterplot]
}`;

const HEXAGON_DECKGL = `setTitle('Hexagon')
setPortCount(1, 1)
setDeckDebug(true)

setViewState({
  longitude: 98.9853,
  latitude: 18.7883,
  zoom: 12,
  pitch: 52,
  bearing: -24
})

const colorRange = [
  [28, 120, 170],
  [55, 174, 170],
  [123, 204, 146],
  [205, 230, 122],
  [247, 196, 89],
  [225, 90, 72]
]

const centers = [
  { name: 'Old City', position: [98.9853, 18.7883], weight: 1.2 },
  { name: 'Nimman', position: [98.9677, 18.7991], weight: 1.0 },
  { name: 'Night Bazaar', position: [99.0006, 18.7833], weight: 0.9 },
  { name: 'Riverside', position: [99.0089, 18.7896], weight: 0.75 },
  { name: 'Doi Suthep Road', position: [98.9495, 18.7965], weight: 0.65 }
]

function makePoint(id, center) {
  const spread = 0.008 + (1.3 - center.weight) * 0.006
  const angle = Math.random() * Math.PI * 2
  const distance = Math.pow(Math.random(), 1.7) * spread

  return {
    id,
    area: center.name,
    position: [
      center.position[0] + Math.cos(angle) * distance,
      center.position[1] + Math.sin(angle) * distance
    ],
    value: Math.round(8 + Math.random() * 18 * center.weight)
  }
}

const points = Array.from({ length: 1800 }, (_, i) => {
  const center = centers[Math.floor(Math.random() * centers.length)]

  return makePoint(i, center)
})

let hoveredHexagon = null

function getPointPosition(point) {
  return point.position
}

function getPointValue(point) {
  return point.value
}

onDeckHover(info => {
  hoveredHexagon = info?.object ?? null

  if (hoveredHexagon) {
    send({
      type: 'hover',
      count: hoveredHexagon.points?.length ?? 0,
      elevation: hoveredHexagon.elevationValue ?? 0
    })
  }
})

function getTileBounds(tile) {
  if (tile.boundingBox) {
    const [[west, south], [east, north]] = tile.boundingBox

    return [west, south, east, north]
  }

  const { west, south, east, north } = tile.bbox

  return [west, south, east, north]
}

function getLayers() {
  return [
    new HexagonLayer({
      id: 'hexagons',
      data: points,
      getPosition: getPointPosition,
      getColorWeight: getPointValue,
      getElevationWeight: getPointValue,
      colorRange,
      radius: 260,
      coverage: 0.82,
      elevationRange: [0, 900],
      elevationScale: 4,
      extruded: true,
      material: {
        ambient: 0.45,
        diffuse: 0.65,
        shininess: 18,
        specularColor: [180, 180, 180]
      }
    })
  ]
}`;

const HEXAGON_FLAT_DECKGL = `setTitle('Hexagon Flat Probe')
setPortCount(1, 0)
setDeckPicking(false)
setDeckDebug(true)

setViewState({
  longitude: 98.9853,
  latitude: 18.7883,
  zoom: 12,
  pitch: 0,
  bearing: 0
})

const colorRange = [
  [28, 120, 170],
  [55, 174, 170],
  [123, 204, 146],
  [205, 230, 122],
  [247, 196, 89],
  [225, 90, 72]
]

const centers = [
  { name: 'Old City', position: [98.9853, 18.7883], weight: 1.2 },
  { name: 'Nimman', position: [98.9677, 18.7991], weight: 1.0 },
  { name: 'Night Bazaar', position: [99.0006, 18.7833], weight: 0.9 },
  { name: 'Riverside', position: [99.0089, 18.7896], weight: 0.75 },
  { name: 'Doi Suthep Road', position: [98.9495, 18.7965], weight: 0.65 }
]

function makePoint(id, center) {
  const spread = 0.008 + (1.3 - center.weight) * 0.006
  const angle = Math.random() * Math.PI * 2
  const distance = Math.pow(Math.random(), 1.7) * spread

  return {
    id,
    area: center.name,
    position: [
      center.position[0] + Math.cos(angle) * distance,
      center.position[1] + Math.sin(angle) * distance
    ],
    value: Math.round(8 + Math.random() * 18 * center.weight)
  }
}

const points = Array.from({ length: 1800 }, (_, i) => {
  const center = centers[Math.floor(Math.random() * centers.length)]

  return makePoint(i, center)
})

function getLayers() {
  return [
    new HexagonLayer({
      id: 'hexagons-flat',
      data: points,
      getPosition: d => d.position,
      getColorWeight: d => d.value,
      colorRange,
      radius: 260,
      coverage: 0.82,
      extruded: false,
      stroked: true,
      getLineColor: [255, 255, 255, 160],
      lineWidthUnits: 'pixels',
      getLineWidth: 1
    })
  ]
}`;

const COLUMN_DECKGL = `setTitle('Column Probe')
setPortCount(1, 0)
setDeckPicking(false)
setDeckDebug(true)

setViewState({
  longitude: 98.9853,
  latitude: 18.7883,
  zoom: 12,
  pitch: 52,
  bearing: -24
})

const colors = [
  [28, 120, 170, 255],
  [55, 174, 170, 255],
  [123, 204, 146, 255],
  [205, 230, 122, 255],
  [247, 196, 89, 255],
  [225, 90, 72, 255]
]

const centers = [
  { name: 'Old City', position: [98.9853, 18.7883], weight: 1.2 },
  { name: 'Nimman', position: [98.9677, 18.7991], weight: 1.0 },
  { name: 'Night Bazaar', position: [99.0006, 18.7833], weight: 0.9 },
  { name: 'Riverside', position: [99.0089, 18.7896], weight: 0.75 },
  { name: 'Doi Suthep Road', position: [98.9495, 18.7965], weight: 0.65 }
]

function makeColumn(id, center) {
  const spread = 0.012 + (1.3 - center.weight) * 0.008
  const angle = Math.random() * Math.PI * 2
  const distance = Math.pow(Math.random(), 1.3) * spread
  const bucket = Math.min(colors.length - 1, Math.floor(Math.random() * colors.length))

  return {
    id,
    position: [
      center.position[0] + Math.cos(angle) * distance,
      center.position[1] + Math.sin(angle) * distance
    ],
    elevation: 80 + bucket * 120 * center.weight,
    color: colors[bucket]
  }
}

const columns = Array.from({ length: 120 }, (_, i) => {
  const center = centers[Math.floor(Math.random() * centers.length)]

  return makeColumn(i, center)
})

function getLayers() {
  return [
    new ColumnLayer({
      id: 'columns',
      data: columns,
      diskResolution: 6,
      radius: 90,
      coverage: 0.9,
      extruded: true,
      getPosition: d => d.position,
      getElevation: d => d.elevation,
      getFillColor: d => d.color,
      material: {
        ambient: 0.45,
        diffuse: 0.65,
        shininess: 18,
        specularColor: [180, 180, 180]
      }
    })
  ]
}`;

const COLUMN_COMMON_DECKGL = `setTitle('Column Common-Unit Probe')
setPortCount(1, 0)
setDeckPicking(false)
setDeckDebug(true)

setViewState({
  longitude: 98.9853,
  latitude: 18.7883,
  zoom: 12,
  pitch: 52,
  bearing: -24
})

const colors = [
  [28, 120, 170, 255],
  [55, 174, 170, 255],
  [123, 204, 146, 255],
  [205, 230, 122, 255],
  [247, 196, 89, 255],
  [225, 90, 72, 255]
]

const columns = Array.from({ length: 120 }, (_, i) => {
  const angle = Math.random() * Math.PI * 2
  const distance = Math.pow(Math.random(), 1.3) * 0.04
  const bucket = i % colors.length

  return {
    id: i,
    position: [
      98.9853 + Math.cos(angle) * distance,
      18.7883 + Math.sin(angle) * distance
    ],
    elevation: 80 + bucket * 120,
    color: colors[bucket]
  }
})

function getLayers() {
  return [
    new ColumnLayer({
      id: 'columns-common',
      data: columns,
      diskResolution: 6,
      radius: 0.0025,
      radiusUnits: 'common',
      coverage: 0.9,
      extruded: true,
      getPosition: d => d.position,
      getElevation: d => d.elevation,
      getFillColor: d => d.color,
      material: {
        ambient: 0.45,
        diffuse: 0.65,
        shininess: 18,
        specularColor: [180, 180, 180]
      }
    })
  ]
}`;

type DeckGLPresetData = {
  code: string;
  messageInletCount?: number;
  messageOutletCount?: number;
  videoInletCount?: number;
  videoOutletCount?: number;
};

export const DECKGL_PRESETS: Record<
  string,
  { type: 'deckgl'; description?: string; data: DeckGLPresetData }
> = {
  'osm.deckgl': {
    type: 'deckgl',
    description: 'OpenStreetMap raster tiles rendered through deck.gl TileLayer',
    data: {
      code: OSM_TILES_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'osm-points.deckgl': {
    type: 'deckgl',
    description: 'Interactive OpenStreetMap points with hover and click picking',
    data: {
      code: OSM_POINTS_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 1,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'hexagon.deckgl': {
    type: 'deckgl',
    description: 'Extruded HexagonLayer heatmap over Chiang Mai',
    data: {
      code: HEXAGON_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 1,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'hexagon-flat.deckgl': {
    type: 'deckgl',
    description: 'Diagnostic flat HexagonLayer over Chiang Mai',
    data: {
      code: HEXAGON_FLAT_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'column.deckgl': {
    type: 'deckgl',
    description: 'Diagnostic direct ColumnLayer over Chiang Mai',
    data: {
      code: COLUMN_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  },
  'column-common.deckgl': {
    type: 'deckgl',
    description: 'Diagnostic ColumnLayer with common-unit radius over Chiang Mai',
    data: {
      code: COLUMN_COMMON_DECKGL.trim(),
      messageInletCount: 1,
      messageOutletCount: 0,
      videoInletCount: 0,
      videoOutletCount: 1
    }
  }
};
