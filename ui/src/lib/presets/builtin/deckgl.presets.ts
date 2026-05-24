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
  }
};
