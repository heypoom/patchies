/**
 * Preset Library Types
 *
 * Hierarchical structure: PresetLibrary > PresetFolder > Preset
 */

/**
 * A single preset - a pre-configured node template
 */
export interface Preset {
  /** Display name, e.g. "Color Picker" */
  name: string;

  /** Brief description of what the preset does */
  description?: string;

  /** The node type, e.g. "glsl", "canvas.dom", "slider" */
  type: string;

  /** The node data to populate when creating from this preset */
  data: unknown;
}

/**
 * A folder entry can be either a preset or a nested folder
 */
export type PresetFolderEntry = Preset | PresetFolder;

/**
 * A folder containing presets and/or nested folders
 * Keys are the entry names (preset name or folder name)
 */
export interface PresetFolder {
  [key: string]: PresetFolderEntry;
}

/**
 * A preset library - the top-level container
 */
export interface PresetLibrary {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Library description */
  description?: string;

  /** Library author */
  author?: string;

  /** If true, library cannot be edited (built-in library) */
  readonly: boolean;

  /** Root folder containing all presets */
  presets: PresetFolder;
}

/**
 * Path to address a preset within libraries
 * e.g. ["built-in", "glsl", "red.gl"]
 */
export type PresetPath = string[];

/**
 * Legacy preset format from lib/presets
 */
export interface LegacyPreset {
  type: string;
  data: unknown;
}

/**
 * Legacy presets record format
 */
export type LegacyPresetsRecord = Record<string, LegacyPreset>;

/**
 * Export format for sharing preset libraries
 */
export interface PresetLibraryExport {
  name: string;
  description?: string;
  author?: string;
  presets: PresetFolder;
}

/**
 * Flattened preset with full path - used for search
 */
export interface FlattenedPreset {
  /** Full path: [libraryId, ...folders, presetName] */
  path: PresetPath;

  /** The preset itself */
  preset: Preset;

  /** Library ID this preset belongs to */
  libraryId: string;

  /** Library name for display */
  libraryName: string;
}
