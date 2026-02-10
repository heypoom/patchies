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

// Help mode - when viewing a help patch (read-only, no autosave)
// Stores the object name being helped, or null if not in help mode
export const helpModeObject = writable<string | null>(null);

// Derived: true when in help mode
export const isHelpMode = derived(helpModeObject, ($obj) => $obj !== null);

// Selected node info - shared from FlowCanvas for context-sensitive help sidebar
// Updated by FlowCanvasInner when selection changes
export const selectedNodeInfo = writable<{ type: string; id: string } | null>(null);

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
export type SidebarView = 'files' | 'presets' | 'packs' | 'saves' | 'help' | 'preview';

const storedSidebarView =
  typeof localStorage !== 'undefined' ? localStorage.getItem('patchies-sidebar-view') : null;

// Don't restore 'preview' view on load since preview content doesn't persist
const initialSidebarView: SidebarView =
  storedSidebarView === 'preview' ? 'files' : (storedSidebarView as SidebarView) || 'files';

export const sidebarView = writable<SidebarView>(initialSidebarView);

// Sidebar width constants - exported for use in SidebarPanel
export const SIDEBAR_DEFAULT_WIDTH = 256;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 1000;

function loadSidebarWidth(): number {
  if (typeof localStorage === 'undefined') return SIDEBAR_DEFAULT_WIDTH;

  const stored = localStorage.getItem('patchies-sidebar-width');
  if (!stored) return SIDEBAR_DEFAULT_WIDTH;

  const parsed = parseInt(stored, 10);
  if (isNaN(parsed) || parsed < SIDEBAR_MIN_WIDTH || parsed > SIDEBAR_MAX_WIDTH) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return parsed;
}

export const sidebarWidth = writable<number>(loadSidebarWidth());

// Persist sidebar state to localStorage
if (typeof localStorage !== 'undefined') {
  isSidebarOpen.subscribe((value) => {
    localStorage.setItem('patchies-sidebar-open', String(value));
  });

  sidebarView.subscribe((value) => {
    localStorage.setItem('patchies-sidebar-view', value);
  });

  sidebarWidth.subscribe((value) => {
    localStorage.setItem('patchies-sidebar-width', String(value));
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
// Patches can have paths like "folder/subfolder/patch-name"
function loadSavedPatchesFromStorage(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = localStorage.getItem('patchies-saved-patches');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Saved folders list - tracks empty folders (folders with patches are implied)
function loadSavedFoldersFromStorage(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const saved = localStorage.getItem('patchies-saved-folders');

    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export const savedPatches = writable<string[]>(loadSavedPatchesFromStorage());
export const savedFolders = writable<string[]>(loadSavedFoldersFromStorage());

// Persist folders to localStorage
if (typeof localStorage !== 'undefined') {
  savedFolders.subscribe((folders) => {
    localStorage.setItem('patchies-saved-folders', JSON.stringify(folders));
  });
}

// Helper to add a patch to the list (called by savePatchToLocalStorage)
export function addSavedPatch(name: string) {
  savedPatches.update((patches) => {
    if (patches.includes(name)) return patches;
    const updated = [...patches, name];
    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));
    return updated;
  });
}

// Helper to add a folder
export function addSavedFolder(path: string) {
  savedFolders.update((folders) => {
    if (folders.includes(path)) return folders;
    return [...folders, path];
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

// Helper to remove a folder and all its contents
export function removeSavedFolder(folderPath: string) {
  const prefix = folderPath + '/';

  // Remove the folder itself
  savedFolders.update((folders) =>
    folders.filter((f) => f !== folderPath && !f.startsWith(prefix))
  );

  // Remove all patches in the folder
  savedPatches.update((patches) => {
    const filtered = patches.filter((p) => !p.startsWith(prefix));
    localStorage.setItem('patchies-saved-patches', JSON.stringify(filtered));
    return filtered;
  });

  // Also remove localStorage entries for those patches
  if (typeof localStorage !== 'undefined') {
    const patches = loadSavedPatchesFromStorage();
    for (const p of patches) {
      if (p.startsWith(prefix)) {
        localStorage.removeItem(`patchies-patch-${p}`);
      }
    }
  }
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

// Helper to rename a folder and update all children paths
export function renameSavedFolder(oldPath: string, newPath: string) {
  const oldPrefix = oldPath + '/';
  const newPrefix = newPath + '/';

  // Update folder paths
  savedFolders.update((folders) =>
    folders.map((f) => {
      if (f === oldPath) return newPath;
      if (f.startsWith(oldPrefix)) return newPrefix + f.slice(oldPrefix.length);
      return f;
    })
  );

  // Update patch paths and their localStorage keys
  savedPatches.update((patches) => {
    const updated = patches.map((p) => {
      if (p.startsWith(oldPrefix)) {
        const newName = newPrefix + p.slice(oldPrefix.length);
        // Move localStorage entry
        if (typeof localStorage !== 'undefined') {
          const data = localStorage.getItem(`patchies-patch-${p}`);
          if (data) {
            localStorage.setItem(`patchies-patch-${newName}`, data);
            localStorage.removeItem(`patchies-patch-${p}`);
          }
        }
        return newName;
      }
      return p;
    });

    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));

    return updated;
  });
}

// Helper to move a patch to a new folder
export function moveSavedPatch(oldPath: string, newPath: string) {
  // Move localStorage entry
  if (typeof localStorage !== 'undefined') {
    const data = localStorage.getItem(`patchies-patch-${oldPath}`);
    if (data) {
      localStorage.setItem(`patchies-patch-${newPath}`, data);
      localStorage.removeItem(`patchies-patch-${oldPath}`);
    }
  }

  // Update patch list
  savedPatches.update((patches) => {
    const updated = patches.map((p) => (p === oldPath ? newPath : p));
    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));
    return updated;
  });
}

// Helper to move a folder and all its contents
export function moveSavedFolder(oldPath: string, newPath: string) {
  const oldPrefix = oldPath + '/';
  const newPrefix = newPath + '/';

  // Update folder paths
  savedFolders.update((folders) =>
    folders.map((f) => {
      if (f === oldPath) return newPath;
      if (f.startsWith(oldPrefix)) return newPrefix + f.slice(oldPrefix.length);
      return f;
    })
  );

  // Update patch paths and their localStorage keys
  savedPatches.update((patches) => {
    const updated = patches.map((p) => {
      if (p.startsWith(oldPrefix)) {
        const newName = newPrefix + p.slice(oldPrefix.length);
        // Move localStorage entry
        if (typeof localStorage !== 'undefined') {
          const data = localStorage.getItem(`patchies-patch-${p}`);
          if (data) {
            localStorage.setItem(`patchies-patch-${newName}`, data);
            localStorage.removeItem(`patchies-patch-${p}`);
          }
        }
        return newName;
      }
      return p;
    });
    localStorage.setItem('patchies-saved-patches', JSON.stringify(updated));
    return updated;
  });
}

// Get the base name from a path (e.g., "folder/patch" -> "patch")
export function getSaveBaseName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

// Get the parent folder from a path (e.g., "folder/patch" -> "folder", "patch" -> "")
export function getSaveParentFolder(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? '' : path.slice(0, lastSlash);
}
