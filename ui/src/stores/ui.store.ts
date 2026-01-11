import { writable, derived } from 'svelte/store';

export const isBottomBarVisible = writable(true);
export const isFpsMonitorVisible = writable(false);

// Initialize isAiFeaturesVisible from localStorage (defaults to true)
const storedAiFeaturesVisible =
	typeof localStorage !== 'undefined' ? localStorage.getItem('ai-features-visible') : null;

export const isAiFeaturesVisible = writable(
	storedAiFeaturesVisible === null ? true : storedAiFeaturesVisible === 'true'
);

// Persist isAiFeaturesVisible to localStorage when it changes
if (typeof localStorage !== 'undefined') {
	isAiFeaturesVisible.subscribe((value) => {
		localStorage.setItem('ai-features-visible', String(value));
	});
}

export const isConnectionMode = writable(false);

// Tracks if XYFlow is actively connecting handles
export const isConnecting = writable(false);

export const connectingFromHandleId = writable<string | null>(null); // ID of the source handle being connected

// Derived store: true when either connection mode is active OR actively connecting
export const shouldShowHandles = derived(
	[isConnectionMode, isConnecting],
	([$isConnectionMode, $isConnecting]) => $isConnectionMode || $isConnecting
);
