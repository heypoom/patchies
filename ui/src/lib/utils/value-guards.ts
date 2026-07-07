export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
