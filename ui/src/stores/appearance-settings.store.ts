import { writable } from 'svelte/store';

const NODE_OPACITY_STORAGE_KEY = 'appearance.nodeOpacity';
const EDGE_OPACITY_STORAGE_KEY = 'appearance.edgeOpacity';
const DEFAULT_OPACITY = 100;

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OPACITY;

  return Math.min(100, Math.max(0, Math.round(value)));
}

function readOpacity(key: string): number {
  if (typeof localStorage === 'undefined') return DEFAULT_OPACITY;

  const stored = localStorage.getItem(key);
  if (stored === null) return DEFAULT_OPACITY;

  return clampOpacity(Number(stored));
}

function persistOpacity(key: string, value: number): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, String(value));
  }
}

export const nodeOpacity = writable(readOpacity(NODE_OPACITY_STORAGE_KEY));
export const edgeOpacity = writable(readOpacity(EDGE_OPACITY_STORAGE_KEY));

export function setNodeOpacity(opacity: number): void {
  const next = clampOpacity(opacity);

  nodeOpacity.set(next);
  persistOpacity(NODE_OPACITY_STORAGE_KEY, next);
}

export function setEdgeOpacity(opacity: number): void {
  const next = clampOpacity(opacity);

  edgeOpacity.set(next);
  persistOpacity(EDGE_OPACITY_STORAGE_KEY, next);
}
