import type { ProjMapNodeData } from './types';

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

export const DEFAULT_PROJMAP_NODE_DATA: ProjMapNodeData = {
  surfaces: []
};
