import { writable, derived } from 'svelte/store';

export const isBottomBarVisible = writable(true);
export const isFpsMonitorVisible = writable(false);
export const isAiFeaturesVisible = writable(true);
export const isConnectionMode = writable(false);

// Tracks if XYFlow is actively connecting handles
export const isConnecting = writable(false);

export const connectingFromHandleId = writable<string | null>(null); // ID of the source handle being connected

// Derived store: true when either connection mode is active OR actively connecting
export const shouldShowHandles = derived(
	[isConnectionMode, isConnecting],
	([$isConnectionMode, $isConnecting]) => $isConnectionMode || $isConnecting
);
