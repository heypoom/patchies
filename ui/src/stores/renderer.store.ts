import { writable } from 'svelte/store';

type NodeId = string;

export const isGlslPlaying = writable(false);
export const previewVisibleMap = writable<Record<NodeId, boolean>>({});
export const hydraSourcesMap = writable<Record<NodeId, (number | null)[]>>({});
