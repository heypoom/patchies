import { presetLibraryStore } from '../../stores/preset-library.store';
import type { PresetLibraryExport } from './types';

export async function importPresetLibraryFile(file: File): Promise<string> {
  const data: unknown = JSON.parse(await file.text());

  if (
    !data ||
    typeof data !== 'object' ||
    !('name' in data) ||
    !data.name ||
    !('presets' in data) ||
    !data.presets
  ) {
    throw new Error('Invalid preset library format');
  }

  const presetLibrary = data as PresetLibraryExport;
  presetLibraryStore.importLibrary(presetLibrary);

  return presetLibrary.name;
}
