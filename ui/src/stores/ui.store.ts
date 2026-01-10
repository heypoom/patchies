import { writable } from 'svelte/store';

export const isBottomBarVisible = writable(true);
export const isFpsMonitorVisible = writable(false);
export const isAiFeaturesVisible = writable(true);
export const isConnectionMode = writable(false);
