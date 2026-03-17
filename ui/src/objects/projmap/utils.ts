import type { ProjMapPoint, ProjMapSurface } from './types';

import { SURFACE_COLORS } from './constants';

export const surfaceColor = (index: number): string =>
  SURFACE_COLORS[index % SURFACE_COLORS.length];

export const toDisplay = (p: ProjMapPoint, w: number, h: number) => ({ x: p.x * w, y: p.y * h });

export const toNorm = (x: number, y: number, w: number, h: number): ProjMapPoint => ({
  x: Math.max(0, Math.min(1, x / w)),
  y: Math.max(0, Math.min(1, y / h))
});

export const polyPoints = (surface: ProjMapSurface, w: number, h: number): string =>
  surface.points.map((p) => `${p.x * w},${p.y * h}`).join(' ');

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;

  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));

  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function findInsertionIndex(
  x: number,
  y: number,
  points: ProjMapPoint[],
  w: number,
  h: number
): number {
  if (points.length < 2) {
    return points.length;
  }

  let minDist = Infinity;
  let bestIndex = points.length;

  for (let i = 0; i < points.length; i++) {
    const a = toDisplay(points[i], w, h);
    const b = toDisplay(points[(i + 1) % points.length], w, h);
    const d = distToSegment(x, y, a.x, a.y, b.x, b.y);

    if (d < minDist) {
      minDist = d;
      bestIndex = i + 1;
    }
  }

  return bestIndex;
}
