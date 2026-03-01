import { writable } from 'svelte/store';

type NodeId = string;

export const isGlslPlaying = writable(false);
export const previewVisibleMap = writable<Record<NodeId, boolean>>({});

/** Override the background output node, bypassing the bg.out connection. null = use bg.out. */
export const overrideOutputNodeId = writable<string | null>(null);
