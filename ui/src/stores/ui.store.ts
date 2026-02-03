import { writable, derived, readable } from 'svelte/store';

// Mobile detection (768px breakpoint)
const MOBILE_BREAKPOINT = 768;

function createIsMobileStore() {
  return readable(false, (set) => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    set(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => set(e.matches);
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  });
}

export const isMobile = createIsMobileStore();

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

export const isObjectBrowserOpen = writable(false);

// Sidebar state - persisted to localStorage
const storedSidebarOpen =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-sidebar-open') : null;

export const isSidebarOpen = writable(storedSidebarOpen === 'true');

// Sidebar view state - persisted to localStorage
export type SidebarView = 'files' | 'presets' | 'packs' | 'saves';

const storedSidebarView =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-sidebar-view') : null;

export const sidebarView = writable<SidebarView>((storedSidebarView as SidebarView) || 'files');

// Persist sidebar state to localStorage
if (typeof localStorage !== 'undefined') {
  isSidebarOpen.subscribe((value) => {
    localStorage.setItem('patchies-sidebar-open', String(value));
  });

  sidebarView.subscribe((value) => {
    localStorage.setItem('patchies-sidebar-view', value);
  });
}

// Tracks if XYFlow is actively connecting handles
export const isConnecting = writable(false);

export const connectingFromHandleId = writable<string | null>(null); // ID of the source handle being connected

// Derived store: true when either connection mode is active OR actively connecting
export const shouldShowHandles = derived(
  [isConnectionMode, isConnecting],
  ([$isConnectionMode, $isConnecting]) => $isConnectionMode || $isConnecting
);

// Track object types used in the current patch
// This allows components outside the SvelteFlow context to see what objects are in the patch
export const patchObjectTypes = writable<Set<string>>(new Set());
