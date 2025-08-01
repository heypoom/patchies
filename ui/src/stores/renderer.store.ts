import { writable } from 'svelte/store';

export const isGlslPlaying = writable(false);
export const previewVisibleMap = writable<Record<string, boolean>>({});
