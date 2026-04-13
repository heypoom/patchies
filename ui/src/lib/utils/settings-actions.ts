/**
 * Shared setting action utilities used by both CommandPalette and SettingsModal.
 * These encapsulate the logic for applying settings, keeping UI components thin.
 */

import { toast } from 'svelte-sonner';
import { GLSystem } from '$lib/canvas/GLSystem';
import { getScreenOutputSize } from '$lib/canvas/constants';
import { useVimInEditor } from '../../stores/editor.store';
import { getSearchParam, setSearchParam } from './search-params';

// ── Output Size ──────────────────────────────────────────────────────

export type OutputSizeResult =
  | { ok: true; width: number; height: number; label: string }
  | { ok: false };

const RESOLUTION_ALIASES: Record<string, [number, number]> = {
  '720p': [1280, 720],
  '1080p': [1920, 1080],
  '2k': [2560, 1440],
  '4k': [3840, 2160]
};

/**
 * Parse and apply an output size string.
 * Supports: WxH, clear, screen, retina, Nx multiplier, 720p/1080p/2k/4k.
 * Returns true if applied successfully.
 */
export function applyOutputSize(input: string): boolean {
  const trimmed = input.trim().toLowerCase();

  // "clear" → remove explicit output size
  if (trimmed === 'clear') {
    const glSystem = GLSystem.getInstance();
    glSystem.clearOutputSize();
    const [w, h] = glSystem.outputSize;
    toast.success(`Output size cleared — using default (${w}×${h})`);
    return true;
  }

  // "screen" → use screen dimensions without DPR
  if (trimmed === 'screen') {
    const [width, height] = getScreenOutputSize();
    GLSystem.getInstance().setOutputSize(width, height);
    toast.success(`Output size set to ${width}×${height}`);
    return true;
  }

  // "retina" → use screen dimensions × devicePixelRatio
  if (trimmed === 'retina') {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.min(8192, Math.round(window.innerWidth * dpr)));
    const height = Math.max(1, Math.min(8192, Math.round(window.innerHeight * dpr)));
    GLSystem.getInstance().setOutputSize(width, height);
    toast.success(`Output size set to ${width}×${height} (${dpr}x DPR)`);
    return true;
  }

  // Resolution aliases (720p, 1080p, 2k, 4k)
  if (Object.hasOwn(RESOLUTION_ALIASES, trimmed)) {
    const [width, height] = RESOLUTION_ALIASES[trimmed];
    GLSystem.getInstance().setOutputSize(width, height);
    toast.success(`Output size set to ${width}×${height} (${trimmed})`);
    return true;
  }

  // "Nx" multiplier → multiply screen dimensions (e.g. 2x, 0.5x)
  const multiplierMatch = trimmed.match(/^(\d+\.?\d*)\s*x$/);
  if (multiplierMatch) {
    const multiplier = Math.min(4, Math.max(0.5, Number(multiplierMatch[1])));
    const width = Math.min(8192, Math.round(window.innerWidth * multiplier));
    const height = Math.min(8192, Math.round(window.innerHeight * multiplier));
    GLSystem.getInstance().setOutputSize(width, height);
    toast.success(`Output size set to ${width}×${height} (${multiplier}x)`);
    return true;
  }

  // "WxH" explicit dimensions
  const match = trimmed.match(/^(\d+)\s*[x×,]\s*(\d+)$/i);
  if (!match) {
    toast.error('Invalid format. Use WIDTHxHEIGHT, screen, retina, Nx, or clear');
    return false;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width < 1 || height < 1 || width > 8192 || height > 8192) {
    toast.error('Size must be between 1 and 8192');
    return false;
  }

  GLSystem.getInstance().setOutputSize(width, height);
  toast.success(`Output size set to ${width}×${height}`);
  return true;
}

// ── Vim Mode ──────────────────────────────────────────────────────────

/** Toggle vim mode and persist to localStorage + store. */
export function setVimMode(enabled: boolean): void {
  localStorage.setItem('editor.vim', String(enabled));
  useVimInEditor.set(enabled);
}

export function toggleVimMode(): boolean {
  const current = localStorage.getItem('editor.vim') === 'true';
  setVimMode(!current);
  return !current;
}

// ── Room ──────────────────────────────────────────────────────────────

/** Get the current room ID from URL params. */
export function getRoom(): string {
  return getSearchParam('room') || '';
}

/**
 * Apply a room ID. Pass empty string to clear.
 * Returns true if a change was made.
 */
export function applyRoom(roomName: string): boolean {
  const trimmed = roomName.trim();
  const current = getRoom();
  if (trimmed === current) return false;

  if (!trimmed) {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(window.history.state, '', url);
    toast.success('Room cleared');
    return true;
  }

  setSearchParam('room', trimmed);
  toast.success(`Room set to "${trimmed}" — reload to connect`);
  return true;
}
