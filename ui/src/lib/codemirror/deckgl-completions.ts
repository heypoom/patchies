import {
  CompletionContext as CMCompletionContext,
  type Completion
} from '@codemirror/autocomplete';
import { isCompletionSuppressedByComment } from '$lib/codemirror/completion-utils';
import { isJavaScriptStringCompletionContext } from '$lib/codemirror/glsl-in-js';
import type { PatchiesContext } from '$lib/codemirror/patchies-completions';

const DECKGL_NODE_TYPE = 'deckgl';

type DeckGLLayerCompletion = {
  label: string;
  detail: string;
  info: string;
  apply?: string;
};

const layerCompletions: DeckGLLayerCompletion[] = [
  {
    label: 'ArcLayer',
    detail: 'new ArcLayer(props)',
    info: 'Render arcs between source and target coordinates.',
    apply:
      "new ArcLayer({\n  id: 'arcs',\n  data,\n  getSourcePosition: d => d.source,\n  getTargetPosition: d => d.target,\n  getSourceColor: [255, 120, 0],\n  getTargetColor: [0, 160, 255],\n  getWidth: 4\n})"
  },
  {
    label: 'BitmapLayer',
    detail: 'new BitmapLayer(props)',
    info: 'Render an image or texture into geographic bounds.',
    apply: "new BitmapLayer({\n  id: 'bitmap',\n  image,\n  bounds: [west, south, east, north]\n})"
  },
  {
    label: 'ColumnLayer',
    detail: 'new ColumnLayer(props)',
    info: 'Render extruded columns at coordinates.',
    apply:
      "new ColumnLayer({\n  id: 'columns',\n  data,\n  getPosition: d => d.position,\n  getElevation: d => d.value,\n  getFillColor: [80, 180, 255]\n})"
  },
  {
    label: 'GeoJsonLayer',
    detail: 'new GeoJsonLayer(props)',
    info: 'Render GeoJSON features as points, lines, and polygons.',
    apply:
      "new GeoJsonLayer({\n  id: 'geojson',\n  data,\n  filled: true,\n  stroked: true,\n  getFillColor: [80, 180, 255, 120],\n  getLineColor: [255, 255, 255]\n})"
  },
  {
    label: 'GreatCircleLayer',
    detail: 'new GreatCircleLayer(props)',
    info: 'Render great-circle arcs between geographic points.',
    apply:
      "new GreatCircleLayer({\n  id: 'great-circles',\n  data,\n  getSourcePosition: d => d.source,\n  getTargetPosition: d => d.target,\n  getWidth: 2\n})"
  },
  {
    label: 'GridCellLayer',
    detail: 'new GridCellLayer(props)',
    info: 'Render extruded grid cells from cell-center coordinates.',
    apply:
      "new GridCellLayer({\n  id: 'grid-cells',\n  data,\n  getPosition: d => d.position,\n  getElevation: d => d.value,\n  getFillColor: [255, 180, 80]\n})"
  },
  {
    label: 'H3ClusterLayer',
    detail: 'new H3ClusterLayer(props)',
    info: 'Render H3 hexagon clusters.',
    apply:
      "new H3ClusterLayer({\n  id: 'h3-clusters',\n  data,\n  getHexagons: d => d.hexagons,\n  getFillColor: [80, 180, 255]\n})"
  },
  {
    label: 'H3HexagonLayer',
    detail: 'new H3HexagonLayer(props)',
    info: 'Render H3 hexagon cells.',
    apply:
      "new H3HexagonLayer({\n  id: 'h3-hexagons',\n  data,\n  getHexagon: d => d.hex,\n  getFillColor: [80, 180, 255, 160]\n})"
  },
  {
    label: 'HexagonLayer',
    detail: 'new HexagonLayer(props)',
    info: 'Aggregate points into extruded 3D hexagonal bins.',
    apply:
      "new HexagonLayer({\n  id: 'hexagons',\n  data,\n  getPosition: d => d.position,\n  radius: 200,\n  extruded: true,\n  elevationScale: 40,\n  pickable: true\n})"
  },
  {
    label: 'IconLayer',
    detail: 'new IconLayer(props)',
    info: 'Render billboarded icons at coordinates.',
    apply:
      "new IconLayer({\n  id: 'icons',\n  data,\n  getPosition: d => d.position,\n  getIcon: d => d.icon,\n  getSize: 32\n})"
  },
  {
    label: 'LineLayer',
    detail: 'new LineLayer(props)',
    info: 'Render line segments between source and target positions.',
    apply:
      "new LineLayer({\n  id: 'lines',\n  data,\n  getSourcePosition: d => d.source,\n  getTargetPosition: d => d.target,\n  getColor: [255, 255, 255],\n  getWidth: 2\n})"
  },
  {
    label: 'MVTLayer',
    detail: 'new MVTLayer(props)',
    info: 'Render Mapbox Vector Tile data.',
    apply:
      "new MVTLayer({\n  id: 'mvt',\n  data: 'https://example.com/{z}/{x}/{y}.mvt',\n  getLineColor: [255, 255, 255],\n  getFillColor: [80, 180, 255, 120]\n})"
  },
  {
    label: 'PathLayer',
    detail: 'new PathLayer(props)',
    info: 'Render paths from arrays of coordinates.',
    apply:
      "new PathLayer({\n  id: 'paths',\n  data,\n  getPath: d => d.path,\n  getColor: [255, 180, 80],\n  getWidth: 4\n})"
  },
  {
    label: 'PointCloudLayer',
    detail: 'new PointCloudLayer(props)',
    info: 'Render 3D point clouds.',
    apply:
      "new PointCloudLayer({\n  id: 'points3d',\n  data,\n  getPosition: d => d.position,\n  getColor: d => d.color,\n  pointSize: 2\n})"
  },
  {
    label: 'PolygonLayer',
    detail: 'new PolygonLayer(props)',
    info: 'Render filled and/or stroked polygons.',
    apply:
      "new PolygonLayer({\n  id: 'polygons',\n  data,\n  getPolygon: d => d.polygon,\n  getFillColor: [80, 180, 255, 120],\n  getLineColor: [255, 255, 255]\n})"
  },
  {
    label: 'QuadkeyLayer',
    detail: 'new QuadkeyLayer(props)',
    info: 'Render cells identified by Bing Maps quadkeys.',
    apply:
      "new QuadkeyLayer({\n  id: 'quadkeys',\n  data,\n  getQuadkey: d => d.quadkey,\n  getFillColor: [80, 180, 255, 160]\n})"
  },
  {
    label: 'S2Layer',
    detail: 'new S2Layer(props)',
    info: 'Render S2 geometry cells.',
    apply:
      "new S2Layer({\n  id: 's2',\n  data,\n  getS2Token: d => d.token,\n  getFillColor: [80, 180, 255, 160]\n})"
  },
  {
    label: 'ScatterplotLayer',
    detail: 'new ScatterplotLayer(props)',
    info: 'Render circles at coordinates.',
    apply:
      "new ScatterplotLayer({\n  id: 'points',\n  data,\n  getPosition: d => d.position,\n  getRadius: 500,\n  getFillColor: d => d.color,\n  radiusUnits: 'meters'\n})"
  },
  {
    label: 'SolidPolygonLayer',
    detail: 'new SolidPolygonLayer(props)',
    info: 'Low-level filled polygon layer used by polygon-based layers.',
    apply:
      "new SolidPolygonLayer({\n  id: 'solid-polygons',\n  data,\n  getPolygon: d => d.polygon,\n  getFillColor: [80, 180, 255, 160]\n})"
  },
  {
    label: 'TerrainLayer',
    detail: 'new TerrainLayer(props)',
    info: 'Render terrain tiles from elevation and texture data.',
    apply:
      "new TerrainLayer({\n  id: 'terrain',\n  elevationData,\n  texture,\n  bounds: [west, south, east, north]\n})"
  },
  {
    label: 'TextLayer',
    detail: 'new TextLayer(props)',
    info: 'Render text labels at coordinates.',
    apply:
      "new TextLayer({\n  id: 'labels',\n  data,\n  getPosition: d => d.position,\n  getText: d => d.label,\n  getSize: 16,\n  getColor: [255, 255, 255]\n})"
  },
  {
    label: 'Tile3DLayer',
    detail: 'new Tile3DLayer(props)',
    info: 'Render 3D Tiles datasets.',
    apply: "new Tile3DLayer({\n  id: 'tiles-3d',\n  data: 'https://example.com/tileset.json'\n})"
  },
  {
    label: 'TileLayer',
    detail: 'new TileLayer(props)',
    info: 'Render tiled raster or vector data, including OSM-style map tiles.',
    apply:
      "new TileLayer({\n  id: 'tiles',\n  data: 'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',\n  minZoom: 0,\n  maxZoom: 19,\n  renderSubLayers: props => {\n    const [[west, south], [east, north]] = props.tile.boundingBox\n\n    return new BitmapLayer(props, {\n      data: null,\n      image: props.data,\n      bounds: [west, south, east, north]\n    })\n  }\n})"
  },
  {
    label: 'TripsLayer',
    detail: 'new TripsLayer(props)',
    info: 'Render animated paths with timestamps.',
    apply:
      "new TripsLayer({\n  id: 'trips',\n  data,\n  getPath: d => d.path,\n  getTimestamps: d => d.timestamps,\n  currentTime: time\n})"
  }
];

const deckglLayerCompletions: Completion[] = layerCompletions.map((completion) => ({
  type: 'class',
  apply: `new ${completion.label}({\n  id: '${completion.label}',\n  data\n})`,
  ...completion
}));

export function createDeckGLCompletionSource(patchiesContext?: PatchiesContext) {
  return (context: CMCompletionContext) => {
    if (patchiesContext?.nodeType !== DECKGL_NODE_TYPE) return null;
    if (isJavaScriptStringCompletionContext(context)) return null;

    const word = context.matchBefore(/\w*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;
    if (isCompletionSuppressedByComment(context, word.from)) return null;

    const typedText = context.state.doc.sliceString(word.from, word.to).toLowerCase();
    const options = deckglLayerCompletions.filter(
      (completion) => !typedText || completion.label.toLowerCase().startsWith(typedText)
    );

    return {
      from: word.from,
      options,
      validFor: /^\w*$/
    };
  };
}

export const getDeckGLCompletionByLabel = (label: string): Completion | undefined =>
  deckglLayerCompletions.find((completion) => completion.label === label);

export const deckglCompletionsSource = (context?: PatchiesContext) =>
  createDeckGLCompletionSource(context);
