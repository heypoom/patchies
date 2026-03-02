export type CurvePoint = { x: number; y: number };
export type CurveMode = 'linear' | 'curve';

export const CURVE_DEFAULT_POINTS: CurvePoint[] = [
  { x: 0, y: 0.5 },
  { x: 1, y: 0.5 }
];

export const CURVE_DEFAULT_WIDTH = 400;
export const CURVE_DEFAULT_HEIGHT = 250;
export const CURVE_MIN_WIDTH = 100;
export const CURVE_MIN_HEIGHT = 80;
export const CURVE_POINT_RADIUS = 7; // visual circle radius
export const CURVE_HIT_RADIUS = 14; // transparent hit-target radius
export const CURVE_DELETE_RADIUS = 9; // delete button radius
export const CURVE_DELETE_DX = 18; // delete button offset from point (x)
export const CURVE_DELETE_DY = -18; // delete button offset from point (y)
export const CURVE_PADDING = 10;
