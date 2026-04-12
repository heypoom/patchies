import { derived, writable } from 'svelte/store';
import { DEFAULT_OUTPUT_SIZE, DEFAULT_PREVIEW_SIZE } from '$lib/canvas/constants';

type NodeId = string;

export const isGlslPlaying = writable(false);
export const previewVisibleMap = writable<Record<NodeId, boolean>>({});

/** Override the background output node, bypassing the bg.out connection. null = use bg.out. */
export const overrideOutputNodeId = writable<string | null>(null);

/** Edge IDs that are feedback back-edges (rendered dashed in the canvas). */
export const feedbackEdgeIds = writable<Set<string>>(new Set());

/** When true, all node previews are disabled (Shift+P toggle). */
export const allPreviewsDisabled = writable(false);

/** Output (FBO) resolution for the current patch. Updates via GLSystem.setOutputSize(). */
export const outputSize = writable<[number, number]>([...DEFAULT_OUTPUT_SIZE]);

/** Preview size for node canvases. Updates when patch output size changes. */
export const previewSize = writable<[number, number]>(DEFAULT_PREVIEW_SIZE);

export const outputWidth = derived(outputSize, (s) => s[0]);
export const outputHeight = derived(outputSize, (s) => s[1]);
export const previewWidth = derived(previewSize, (s) => s[0]);
export const previewHeight = derived(previewSize, (s) => s[1]);

/** Available FPS cap options. 0 = unlimited (match display refresh rate). */
export const FPS_CAP_OPTIONS = [0, 30, 60] as const;

export type FpsCap = (typeof FPS_CAP_OPTIONS)[number];

const FPS_CAP_STORAGE_KEY = 'patchies:renderFpsCap';

function loadFpsCap(): FpsCap {
  if (typeof localStorage === 'undefined') return 0;
  const stored = localStorage.getItem(FPS_CAP_STORAGE_KEY);

  if (stored !== null) {
    const parsed = Number(stored);
    if (FPS_CAP_OPTIONS.includes(parsed as FpsCap)) return parsed as FpsCap;
  }

  return 0;
}

/** Render FPS cap. 0 = unlimited. Persisted to localStorage. */
export const renderFpsCap = writable<FpsCap>(loadFpsCap());

renderFpsCap.subscribe((fps) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(FPS_CAP_STORAGE_KEY, String(fps));
  }
});
