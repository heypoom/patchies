import { writable, derived, get } from 'svelte/store';
import type {
  PresetLibrary,
  PresetFolder,
  Preset,
  PresetPath,
  PresetLibraryExport
} from '$lib/presets/types';
import {
  generateLibraryId,
  cloneFolder,
  setEntryAtPath,
  removeEntryAtPath,
  flattenPresets,
  getPresetByPath,
  isPreset
} from '$lib/presets/preset-utils';
import { migrateLegacyPresets } from '$lib/presets/migrate-legacy';
import { PRESETS } from '$lib/presets/presets';

const STORAGE_KEY = 'patchies:preset-libraries';
const BUILTIN_LIBRARY_ID = 'built-in';
const USER_LIBRARY_ID = 'user';

/**
 * Create the built-in library from legacy presets
 */
function createBuiltinLibrary(): PresetLibrary {
  return {
    id: BUILTIN_LIBRARY_ID,
    name: 'Built-in',
    description: 'Default presets included with Patchies',
    readonly: true,
    presets: migrateLegacyPresets(PRESETS)
  };
}

/**
 * Create the default user library
 */
function createUserLibrary(): PresetLibrary {
  return {
    id: USER_LIBRARY_ID,
    name: 'User',
    description: 'Your personal presets',
    readonly: false,
    presets: {}
  };
}

/**
 * Load libraries from localStorage
 */
function loadFromStorage(): PresetLibrary[] | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    console.warn('Failed to load preset libraries from localStorage');
    return null;
  }
}

/**
 * Save libraries to localStorage
 */
function saveToStorage(libraries: PresetLibrary[]): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
  } catch (e) {
    console.error('Failed to save preset libraries to localStorage', e);
  }
}

/**
 * Initialize libraries, ensuring built-in and user libraries exist
 */
function initializeLibraries(): PresetLibrary[] {
  const stored = loadFromStorage();

  if (stored && stored.length > 0) {
    // Always replace built-in library with fresh version to pick up changes
    const builtinIndex = stored.findIndex((lib) => lib.id === BUILTIN_LIBRARY_ID);

    if (builtinIndex >= 0) {
      stored[builtinIndex] = createBuiltinLibrary();
    } else {
      stored.unshift(createBuiltinLibrary());
    }

    // Ensure user library exists
    const hasUser = stored.some((lib) => lib.id === USER_LIBRARY_ID);
    if (!hasUser) {
      // Insert after built-in
      const builtinIndex = stored.findIndex((lib) => lib.id === BUILTIN_LIBRARY_ID);
      stored.splice(builtinIndex + 1, 0, createUserLibrary());
    }

    return stored;
  }

  // First time: create built-in and user libraries
  return [createBuiltinLibrary(), createUserLibrary()];
}

/**
 * Create the preset library store
 */
function createPresetLibraryStore() {
  const { subscribe, update } = writable<PresetLibrary[]>(initializeLibraries());

  // Auto-save to localStorage on changes
  subscribe((libraries) => {
    saveToStorage(libraries);
  });

  return {
    subscribe,

    /**
     * Add a new library
     */
    addLibrary(name: string, description?: string, author?: string): string {
      const id = generateLibraryId();
      const newLibrary: PresetLibrary = {
        id,
        name,
        description,
        author,
        readonly: false,
        presets: {}
      };

      update((libs) => [...libs, newLibrary]);
      return id;
    },

    /**
     * Remove a library (cannot remove built-in or user libraries)
     */
    removeLibrary(libraryId: string): boolean {
      if (libraryId === BUILTIN_LIBRARY_ID || libraryId === USER_LIBRARY_ID) {
        console.warn('Cannot remove built-in or user library');
        return false;
      }

      update((libs) => libs.filter((lib) => lib.id !== libraryId));
      return true;
    },

    /**
     * Rename a library
     */
    renameLibrary(libraryId: string, newName: string): void {
      update((libs) => libs.map((lib) => (lib.id === libraryId ? { ...lib, name: newName } : lib)));
    },

    /**
     * Update library metadata
     */
    updateLibrary(
      libraryId: string,
      updates: Partial<Pick<PresetLibrary, 'name' | 'description' | 'author'>>
    ): void {
      update((libs) =>
        libs.map((lib) => (lib.id === libraryId && !lib.readonly ? { ...lib, ...updates } : lib))
      );
    },

    /**
     * Add a preset to a library at the given path
     * @param libraryId The library to add to
     * @param folderPath Path to the folder (empty for root)
     * @param preset The preset to add
     */
    addPreset(libraryId: string, folderPath: PresetPath, preset: Preset): boolean {
      let success = false;

      update((libs) =>
        libs.map((lib) => {
          if (lib.id !== libraryId || lib.readonly) return lib;

          const fullPath = [...folderPath, preset.name];
          const newPresets = setEntryAtPath(lib.presets, fullPath, preset);
          success = true;

          return { ...lib, presets: newPresets };
        })
      );

      return success;
    },

    /**
     * Remove a preset from a library
     * @param libraryId The library ID
     * @param presetPath Path to the preset (including preset name)
     */
    removePreset(libraryId: string, presetPath: PresetPath): boolean {
      let success = false;

      update((libs) =>
        libs.map((lib) => {
          if (lib.id !== libraryId || lib.readonly) return lib;

          const newPresets = removeEntryAtPath(lib.presets, presetPath);
          success = true;

          return { ...lib, presets: newPresets };
        })
      );

      return success;
    },

    /**
     * Create a folder in a library
     */
    createFolder(libraryId: string, parentPath: PresetPath, folderName: string): boolean {
      let success = false;

      update((libs) =>
        libs.map((lib) => {
          if (lib.id !== libraryId || lib.readonly) return lib;

          const fullPath = [...parentPath, folderName];
          const newPresets = setEntryAtPath(lib.presets, fullPath, {});
          success = true;

          return { ...lib, presets: newPresets };
        })
      );

      return success;
    },

    /**
     * Remove a folder from a library
     */
    removeFolder(libraryId: string, folderPath: PresetPath): boolean {
      return this.removePreset(libraryId, folderPath); // Same logic
    },

    /**
     * Rename a preset or folder
     */
    renameEntry(libraryId: string, entryPath: PresetPath, newName: string): boolean {
      let success = false;

      update((libs) =>
        libs.map((lib) => {
          if (lib.id !== libraryId || lib.readonly) return lib;

          // Get the current entry
          let current: PresetFolder | Preset = lib.presets;
          for (let i = 0; i < entryPath.length - 1; i++) {
            current = (current as PresetFolder)[entryPath[i]] as PresetFolder;
            if (!current) return lib;
          }

          const oldName = entryPath[entryPath.length - 1];
          const entry = (current as PresetFolder)[oldName];
          if (!entry) return lib;

          // Update the name in the entry if it's a preset
          const updatedEntry = isPreset(entry) ? { ...entry, name: newName } : cloneFolder(entry);

          // Remove old, add new
          let newPresets = removeEntryAtPath(lib.presets, entryPath);
          const newPath = [...entryPath.slice(0, -1), newName];
          newPresets = setEntryAtPath(newPresets, newPath, updatedEntry);

          success = true;
          return { ...lib, presets: newPresets };
        })
      );

      return success;
    },

    /**
     * Import a library from export format
     */
    importLibrary(exported: PresetLibraryExport): string {
      const id = generateLibraryId();
      const newLibrary: PresetLibrary = {
        id,
        name: exported.name,
        description: exported.description,
        author: exported.author,
        readonly: false,
        presets: exported.presets
      };

      update((libs) => [...libs, newLibrary]);
      return id;
    },

    /**
     * Export a library
     */
    exportLibrary(libraryId: string): PresetLibraryExport | null {
      const libs = get({ subscribe });
      const lib = libs.find((l) => l.id === libraryId);
      if (!lib) return null;

      return {
        name: lib.name,
        description: lib.description,
        author: lib.author,
        presets: lib.presets
      };
    },

    /**
     * Get a library by ID
     */
    getLibrary(libraryId: string): PresetLibrary | undefined {
      const libs = get({ subscribe });
      return libs.find((l) => l.id === libraryId);
    },

    /**
     * Get preset by full path
     */
    getPresetByPath(path: PresetPath): Preset | undefined {
      const libs = get({ subscribe });
      return getPresetByPath(libs, path);
    },

    /**
     * Move a preset or folder to a new location
     * @param sourceLibraryId Source library ID
     * @param sourcePath Path to the entry (including entry name)
     * @param targetLibraryId Target library ID
     * @param targetFolderPath Path to the target folder (empty for library root)
     * @returns true if move was successful
     */
    moveEntry(
      sourceLibraryId: string,
      sourcePath: PresetPath,
      targetLibraryId: string,
      targetFolderPath: PresetPath
    ): boolean {
      const libs = get({ subscribe });

      // Find source and target libraries
      const sourceLib = libs.find((l) => l.id === sourceLibraryId);
      const targetLib = libs.find((l) => l.id === targetLibraryId);

      if (!sourceLib || !targetLib) return false;

      // Cannot move from/to readonly libraries
      if (sourceLib.readonly || targetLib.readonly) return false;

      // Get the entry to move
      let current: PresetFolder | Preset = sourceLib.presets;
      for (let i = 0; i < sourcePath.length - 1; i++) {
        current = (current as PresetFolder)[sourcePath[i]] as PresetFolder;
        if (!current) return false;
      }
      const entryName = sourcePath[sourcePath.length - 1];
      const entry = (current as PresetFolder)[entryName];
      if (!entry) return false;

      // Check if moving to the same location
      const sourcePathStr = `${sourceLibraryId}/${sourcePath.join('/')}`;
      const targetPathStr = `${targetLibraryId}/${[...targetFolderPath, entryName].join('/')}`;
      if (sourcePathStr === targetPathStr) return false;

      // Check if moving a folder into itself
      if (!isPreset(entry)) {
        const targetFullPath = `${targetLibraryId}/${targetFolderPath.join('/')}`;
        const sourceFullPath = `${sourceLibraryId}/${sourcePath.join('/')}`;
        if (targetFullPath.startsWith(sourceFullPath + '/') || targetFullPath === sourceFullPath) {
          return false;
        }
      }

      // Clone the entry (update name if it's a preset)
      const clonedEntry = isPreset(entry) ? { ...entry } : cloneFolder(entry);

      let success = false;

      update((libraries) =>
        libraries.map((lib) => {
          // Handle source library - remove the entry
          if (lib.id === sourceLibraryId && !lib.readonly) {
            const newPresets = removeEntryAtPath(lib.presets, sourcePath);
            // If source and target are the same library, also add the entry
            if (sourceLibraryId === targetLibraryId) {
              const targetPath = [...targetFolderPath, entryName];
              const finalPresets = setEntryAtPath(newPresets, targetPath, clonedEntry);
              success = true;
              return { ...lib, presets: finalPresets };
            }
            return { ...lib, presets: newPresets };
          }

          // Handle target library (if different from source) - add the entry
          if (lib.id === targetLibraryId && sourceLibraryId !== targetLibraryId && !lib.readonly) {
            const targetPath = [...targetFolderPath, entryName];
            const newPresets = setEntryAtPath(lib.presets, targetPath, clonedEntry);
            success = true;
            return { ...lib, presets: newPresets };
          }

          return lib;
        })
      );

      return success;
    }
  };
}

export const presetLibraryStore = createPresetLibraryStore();

/**
 * Derived store: all presets flattened for search
 */
export const flattenedPresets = derived(presetLibraryStore, ($libraries) =>
  flattenPresets($libraries)
);

/**
 * Derived store: editable libraries only (excludes readonly)
 */
export const editableLibraries = derived(presetLibraryStore, ($libraries) =>
  $libraries.filter((lib) => !lib.readonly)
);
