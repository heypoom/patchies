import { presetLibraryStore } from '../../stores/preset-library.store';
import type { PresetFolder, PresetLibraryExport } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPreset(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    'data' in value &&
    (value.description === undefined || typeof value.description === 'string')
  );
}

function isPresetFolder(value: unknown): value is PresetFolder {
  if (!isRecord(value)) return false;

  return Object.values(value).every((entry) => {
    if (!isRecord(entry)) return false;
    if ('name' in entry || 'type' in entry || 'data' in entry) return isPreset(entry);

    return isPresetFolder(entry);
  });
}

function isPresetLibraryExport(value: unknown): value is PresetLibraryExport {
  if (!isRecord(value) || typeof value.name !== 'string' || !isPresetFolder(value.presets)) {
    return false;
  }

  return (
    (value.description === undefined || typeof value.description === 'string') &&
    (value.author === undefined || typeof value.author === 'string')
  );
}

async function parsePresetLibraryFile(file: File): Promise<PresetLibraryExport> {
  const data: unknown = JSON.parse(await file.text());

  if (!isPresetLibraryExport(data)) {
    throw new Error('Invalid preset library format');
  }

  return data;
}

export async function importPresetLibraryFiles(files: Iterable<File>): Promise<string[]> {
  const presetLibraries = await Promise.all([...files].map(parsePresetLibraryFile));

  for (const presetLibrary of presetLibraries) {
    presetLibraryStore.importLibrary(presetLibrary);
  }

  return presetLibraries.map((library) => library.name);
}
