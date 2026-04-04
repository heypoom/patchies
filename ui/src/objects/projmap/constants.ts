import type { ProjMapNodeData, ProjMapPoint } from './types';

export const PROJMAP_VIDEO_INLET_COUNT = 4;

/** Colors for each surface, cycled by index */
export const SURFACE_COLORS = [
  '#4ade80', // green
  '#60a5fa', // blue
  '#f472b6', // pink
  '#fb923c', // orange
  '#a78bfa', // purple
  '#34d399' // teal
];

/** Default 4 corners for a warp surface — centered rectangle with 10% margin */
export const DEFAULT_WARP_CORNERS: ProjMapPoint[] = [
  { x: 0.1, y: 0.1 }, // top-left
  { x: 0.9, y: 0.1 }, // top-right
  { x: 0.9, y: 0.9 }, // bottom-right
  { x: 0.1, y: 0.9 } // bottom-left
];

/** Subdivision count for warp mesh (higher = smoother perspective, more geometry) */
export const WARP_SUBDIVISIONS = 20;

/** Corner labels for warp mode */
export const WARP_CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'];

export const DEFAULT_PROJMAP_NODE_DATA: ProjMapNodeData = {
  surfaces: [],
  showOverlay: true
};
