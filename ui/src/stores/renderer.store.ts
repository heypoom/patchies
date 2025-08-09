import { writable } from 'svelte/store';

type NodeId = string;

export const isGlslPlaying = writable(false);
export const previewVisibleMap = writable<Record<NodeId, boolean>>({});
export const outputSize = writable<[number, number]>([800, 600]);
export const previewSize = writable<[number, number]>([800 / 4, 600 / 4]);
