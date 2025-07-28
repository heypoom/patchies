import { writable } from 'svelte/store';

export const audioUrlCache = writable<Record<string, string>>({});
