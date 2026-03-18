export interface ProjMapPoint {
  x: number; // normalized [0, 1]
  y: number; // normalized [0, 1]
}

export interface ProjMapSurface {
  id: string;
  points: ProjMapPoint[];
}

export interface ProjMapNodeData {
  surfaces: ProjMapSurface[];
  showOverlay?: boolean;
}
