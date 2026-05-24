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
  }
};
