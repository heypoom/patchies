export interface ProjMapPoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
}

export type ProjMapSurfaceMode = 'warp' | 'mask';

export interface ProjMapSurface {
  id: string;
  mode: ProjMapSurfaceMode;
  points: ProjMapPoint[];
}

export interface ProjMapNodeData {
  surfaces: ProjMapSurface[];
  showOverlay?: boolean;
}
