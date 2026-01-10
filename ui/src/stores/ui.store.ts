import { writable } from 'svelte/store';

export const isBottomBarVisible = writable(true);
export const isFpsMonitorVisible = writable(false);
export const isAiFeaturesVisible = writable(true);
export const isConnectionMode = writable(false);
export const isConnecting = writable(false); // Tracks if XYFlow is actively connecting handles
export const connectingFromHandleId = writable<string | null>(null); // ID of the source handle being connected
