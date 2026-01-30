import type {
  Preset,
  PresetFolder,
  PresetFolderEntry,
  PresetLibrary,
  PresetPath,
  FlattenedPreset
} from './types';

/**
 * Type guard to check if an entry is a Preset (not a folder)
 */
export function isPreset(entry: PresetFolderEntry): entry is Preset {
  return (
    entry !== null &&
    typeof entry === 'object' &&
    'type' in entry &&
    'data' in entry &&
    'name' in entry
  );
}

/**
 * Type guard to check if an entry is a folder
 */
export function isFolder(entry: PresetFolderEntry): entry is PresetFolder {
  return !isPreset(entry);
}

/**
 * Get a preset or folder by path within a library
 * @param library The library to search in
 * @param path Path segments after the library ID (e.g., ["glsl", "red.gl"])
 * @returns The entry at that path, or undefined if not found
 */
export function getEntryByPath(
  library: PresetLibrary,
  path: PresetPath
): PresetFolderEntry | undefined {
  let current: PresetFolderEntry = library.presets;

  for (const segment of path) {
    if (isPreset(current)) {
      // Can't traverse into a preset
      return undefined;
    }
    const folder = current as PresetFolder;
    const next: PresetFolderEntry | undefined = folder[segment];
    if (next === undefined) {
      return undefined;
    }
    current = next;
  }

  return current;
}

/**
 * Get a preset by its full path (including library ID)
 * @param libraries All libraries to search
 * @param path Full path: [libraryId, ...folders, presetName]
 */
export function getPresetByPath(libraries: PresetLibrary[], path: PresetPath): Preset | undefined {
  if (path.length < 2) return undefined;

  const [libraryId, ...rest] = path;
  const library = libraries.find((lib) => lib.id === libraryId);
  if (!library) return undefined;

  const entry = getEntryByPath(library, rest);
  return entry && isPreset(entry) ? entry : undefined;
}

/**
 * Flatten all presets from libraries into a searchable list
 */
export function flattenPresets(libraries: PresetLibrary[]): FlattenedPreset[] {
  const result: FlattenedPreset[] = [];

  for (const library of libraries) {
    flattenFolder(library.presets, [library.id], library, result);
  }

  return result;
}

function flattenFolder(
  folder: PresetFolder,
  currentPath: PresetPath,
  library: PresetLibrary,
  result: FlattenedPreset[]
): void {
  for (const [key, entry] of Object.entries(folder)) {
    const entryPath = [...currentPath, key];

    if (isPreset(entry)) {
      result.push({
        path: entryPath,
        preset: entry,
        libraryId: library.id,
        libraryName: library.name
      });
    } else {
      flattenFolder(entry, entryPath, library, result);
    }
  }
}

/**
 * Format a preset path for display
 * e.g., ["built-in", "glsl", "red.gl"] -> "built-in > glsl > red.gl"
 */
export function formatPresetPath(path: PresetPath, separator = ' > '): string {
  return path.join(separator);
}

/**
 * Generate a unique ID for a new library
 */
export function generateLibraryId(): string {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Deep clone a preset folder (for safe mutations)
 */
export function cloneFolder(folder: PresetFolder): PresetFolder {
  return JSON.parse(JSON.stringify(folder));
}

/**
 * Set an entry at a path within a folder, creating intermediate folders as needed
 * Returns a new folder (immutable)
 */
export function setEntryAtPath(
  root: PresetFolder,
  path: PresetPath,
  entry: PresetFolderEntry
): PresetFolder {
  if (path.length === 0) {
    throw new Error('Path cannot be empty');
  }

  const newRoot = cloneFolder(root);
  let current = newRoot;

  // Navigate/create to parent folder
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (!(segment in current) || isPreset(current[segment])) {
      // Create folder if it doesn't exist or is a preset
      current[segment] = {};
    }
    current = current[segment] as PresetFolder;
  }

  // Set the entry at the final path segment
  const finalKey = path[path.length - 1];
  current[finalKey] = entry;

  return newRoot;
}

/**
 * Remove an entry at a path within a folder
 * Returns a new folder (immutable)
 */
export function removeEntryAtPath(root: PresetFolder, path: PresetPath): PresetFolder {
  if (path.length === 0) {
    throw new Error('Path cannot be empty');
  }

  const newRoot = cloneFolder(root);
  let current = newRoot;

  // Navigate to parent folder
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (!(segment in current) || isPreset(current[segment])) {
      // Path doesn't exist
      return newRoot;
    }
    current = current[segment] as PresetFolder;
  }

  // Remove the entry
  const finalKey = path[path.length - 1];
  delete current[finalKey];

  return newRoot;
}
