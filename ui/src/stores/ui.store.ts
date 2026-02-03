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

// Current patch name - tracks which patch is currently being edited
// null = untitled/new patch, string = named patch
const storedCurrentPatchName =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-current-patch-name') : null;

export const currentPatchName = writable<string | null>(storedCurrentPatchName);

// Persist current patch name to localStorage
if (typeof localStorage !== 'undefined') {
  currentPatchName.subscribe((value) => {
    if (value) {
      localStorage.setItem('patchies-current-patch-name', value);
    } else {
      localStorage.removeItem('patchies-current-patch-name');
    }
  });
}

// Saved patches list - reactive store for sidebar
function loadSavedPatchesFromStorage(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = localStorage.getItem('patchies-saved-patches');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export const savedPatches = writable<string[]>(loadSavedPatchesFromStorage());

// Helper to add a patch to the list (called by savePatchToLocalStorage)
export function addSavedPatch(name: string) {
  savedPatches.update((patches) => {
    if (patches.includes(name)) return patches;
    const updated = [...patches, name];
    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));
    return updated;
  });
}

// Helper to remove a patch from the list
export function removeSavedPatch(name: string) {
  savedPatches.update((patches) => {
    const filtered = patches.filter((p) => p !== name);
    localStorage.setItem('patchies-saved-patches', JSON.stringify(filtered));
    return filtered;
  });
}

// Helper to rename a patch in the list
export function renameSavedPatch(oldName: string, newName: string) {
  savedPatches.update((patches) => {
    const index = patches.indexOf(oldName);
    if (index === -1) return patches;
    const updated = [...patches];
    updated[index] = newName;
    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));
    return updated;
  });
}
