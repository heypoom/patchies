import type { CurvePoint as Point, CurveMode as Mode } from './constants';
import { CURVE_HIT_RADIUS, CURVE_DELETE_DX, CURVE_DELETE_DY } from './constants';
import { match } from 'ts-pattern';

// ── Hit testing ───────────────────────────────────────────────────────────────

function distSqToSegment(
  cx: number,
  cy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax,
    dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lenSq));
  const nx = ax + t * dx - cx;
  const ny = ay + t * dy - cy;
  return nx * nx + ny * ny;
}

// For non-endpoints: capsule from point center to delete button covers both circles
// and the gap between them — eliminating the flicker dead zone.
export function getHoveredIdx(
  sx: number,
  sy: number,
  pts: Point[],
  innerW: number,
  innerH: number
): number {
  for (let i = 0; i < pts.length; i++) {
    const [px, py] = toSvg(pts[i], innerW, innerH);
    if (i === 0 || i === pts.length - 1) {
      const dx = px - sx,
        dy = py - sy;
      if (dx * dx + dy * dy < CURVE_HIT_RADIUS * CURVE_HIT_RADIUS) return i;
    } else {
      const bx = px + CURVE_DELETE_DX,
        by = py + CURVE_DELETE_DY;
      if (distSqToSegment(sx, sy, px, py, bx, by) < CURVE_HIT_RADIUS * CURVE_HIT_RADIUS) return i;
    }
  }
  return -1;
}

// ── Coordinate transforms: normalized [0,1] ↔ SVG pixel space ────────────────

export function toSvg(p: Point, innerW: number, innerH: number): [number, number] {
  return [p.x * innerW, (1 - p.y) * innerH];
}

export function fromSvg(svgX: number, svgY: number, innerW: number, innerH: number): Point {
  return {
    x: Math.max(0, Math.min(1, svgX / innerW)),
    y: Math.max(0, Math.min(1, 1 - svgY / innerH))
  };
}

// ── Path generation ───────────────────────────────────────────────────────────

export function buildLinearPath(pts: Point[], innerW: number, innerH: number): string {
  if (pts.length < 2) return '';
  return pts
    .map((p, i) => {
      const [sx, sy] = toSvg(p, innerW, innerH);
      return i === 0 ? `M ${sx},${sy}` : `L ${sx},${sy}`;
    })
    .join(' ');
}

export function buildCurvePath(pts: Point[], innerW: number, innerH: number): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return buildLinearPath(pts, innerW, innerH);

  const sp = pts.map((p) => toSvg(p, innerW, innerH));
  const n = sp.length;
  let d = `M ${sp[0][0]},${sp[0][1]}`;

  for (let i = 0; i < n - 1; i++) {
    const p0 = sp[Math.max(0, i - 1)];
    const p1 = sp[i];
    const p2 = sp[i + 1];
    const p3 = sp[Math.min(n - 1, i + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
  }

  return d;
}

export function buildPath(mode: Mode, pts: Point[], innerW: number, innerH: number): string {
  return match(mode)
    .with('linear', () => buildLinearPath(pts, innerW, innerH))
    .with('curve', () => buildCurvePath(pts, innerW, innerH))
    .exhaustive();
}

// ── Curve evaluation ──────────────────────────────────────────────────────────

export function evaluateLinear(x: number, pts: Point[]): number {
  const clamped = Math.max(0, Math.min(1, x));
  for (let i = 0; i < pts.length - 1; i++) {
    if (clamped >= pts[i].x && clamped <= pts[i + 1].x) {
      const dx = pts[i + 1].x - pts[i].x;
      if (dx < 1e-10) return pts[i].y;
      const t = (clamped - pts[i].x) / dx;
      return pts[i].y + t * (pts[i + 1].y - pts[i].y);
    }
  }
  return pts[pts.length - 1].y;
}

export function evaluateCurve(x: number, pts: Point[]): number {
  if (pts.length < 2) return 0;
  if (pts.length === 2) return evaluateLinear(x, pts);

  const clamped = Math.max(0, Math.min(1, x));
  const n = pts.length;

  for (let i = 0; i < n - 1; i++) {
    if (clamped >= pts[i].x && clamped <= pts[i + 1].x) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(n - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      // Solve for t using Newton's method on the x bezier
      let t = p2.x - p1.x > 1e-10 ? (clamped - p1.x) / (p2.x - p1.x) : 0.5;
      for (let iter = 0; iter < 10; iter++) {
        const u = 1 - t;
        const bx =
          u * u * u * p1.x + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * p2.x;
        const dbx =
          3 * u * u * (cp1x - p1.x) + 6 * u * t * (cp2x - cp1x) + 3 * t * t * (p2.x - cp2x);
        if (Math.abs(dbx) < 1e-10) break;
        t -= (bx - clamped) / dbx;
        t = Math.max(0, Math.min(1, t));
      }

      // Evaluate y at t
      const u = 1 - t;
      return u * u * u * p1.y + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * p2.y;
    }
  }
  return pts[n - 1].y;
}

export function evaluate(mode: Mode, x: number, pts: Point[]): number {
  return match(mode)
    .with('linear', () => evaluateLinear(x, pts))
    .with('curve', () => evaluateCurve(x, pts))
    .exhaustive();
}
