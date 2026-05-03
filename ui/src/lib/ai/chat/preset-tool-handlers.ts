import type { Preset, PresetPath } from '$lib/presets/types';

import type { ChatAction } from './resolver';
import { resolveInsertObject } from './direct-tool-handlers';

export interface AvailablePreset {
  path: PresetPath;
  preset: Preset;
  libraryId: string;
  libraryName: string;
  pack?: {
    id: string;
    name: string;
  };
}

interface SearchPresetsArgs {
  query?: unknown;
  limit?: unknown;
  maxResults?: unknown;
}

interface InsertPresetArgs {
  presetName?: unknown;
  position?: unknown;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function searchableText(preset: AvailablePreset): string {
  return [
    preset.preset.name,
    preset.preset.description ?? '',
    preset.preset.type,
    preset.libraryName,
    preset.path.join(' '),
    preset.pack?.id ?? '',
    preset.pack?.name ?? ''
  ]
    .join(' ')
    .toLowerCase();
}

function scorePreset(preset: AvailablePreset, query: string): number {
  const name = normalize(preset.preset.name);
  const packName = normalize(preset.pack?.name ?? '');
  const packId = normalize(preset.pack?.id ?? '');
  const path = normalize(preset.path.join(' '));
  const text = searchableText(preset);

  if (name === query) return 0;
  if (packName === query || packId === query) return 1;
  if (name.startsWith(query)) return 2;
  if (packName.startsWith(query) || packId.startsWith(query)) return 3;
  if (path.includes(query)) return 4;
  if (text.includes(query)) return 5;

  return 10;
}

function preferUserLibraries(a: AvailablePreset, b: AvailablePreset): number {
  const aBuiltIn = a.libraryId === 'built-in';
  const bBuiltIn = b.libraryId === 'built-in';

  if (aBuiltIn === bBuiltIn) return 0;

  return aBuiltIn ? 1 : -1;
}

function findPresetByExactName(
  presetName: string,
  presets: AvailablePreset[]
): AvailablePreset | undefined {
  return presets
    .filter((entry) => normalize(entry.preset.name) === normalize(presetName))
    .sort(preferUserLibraries)[0];
}

export function searchAvailablePresets(args: SearchPresetsArgs, presets: AvailablePreset[]) {
  const query = normalize(typeof args.query === 'string' ? args.query : '');
  const rawLimit =
    typeof args.limit === 'number'
      ? args.limit
      : typeof args.maxResults === 'number'
        ? args.maxResults
        : 10;
  const limit = Math.min(Math.max(rawLimit, 1), 50);

  if (!query) {
    return { results: [], total: 0 };
  }

  const matches = presets
    .filter((preset) => searchableText(preset).includes(query))
    .sort((a, b) => {
      const scoreDiff = scorePreset(a, query) - scorePreset(b, query);
      if (scoreDiff !== 0) return scoreDiff;

      const libraryDiff = preferUserLibraries(a, b);
      if (libraryDiff !== 0) return libraryDiff;

      return a.preset.name.localeCompare(b.preset.name);
    });

  return {
    results: matches.slice(0, limit).map((match) => ({
      name: match.preset.name,
      type: match.preset.type,
      description: match.preset.description,
      libraryId: match.libraryId,
      libraryName: match.libraryName,
      path: match.path,
      pack: match.pack
    })),
    total: matches.length
  };
}

export function getPresetContent(args: InsertPresetArgs, presets: AvailablePreset[]) {
  const presetName = typeof args.presetName === 'string' ? args.presetName.trim() : '';

  if (!presetName) {
    return { error: 'presetName must be a non-empty string' };
  }

  const match = findPresetByExactName(presetName, presets);

  if (!match) {
    return { error: `Preset "${presetName}" not found. Call search_presets first.` };
  }

  return {
    name: match.preset.name,
    type: match.preset.type,
    description: match.preset.description,
    data: match.preset.data,
    libraryId: match.libraryId,
    libraryName: match.libraryName,
    path: match.path,
    pack: match.pack
  };
}

export function resolveInsertPreset(
  args: InsertPresetArgs,
  deps: { presets: AvailablePreset[] }
): ChatAction {
  const presetName = typeof args.presetName === 'string' ? args.presetName.trim() : '';

  if (!presetName) {
    throw new Error('presetName must be a non-empty string');
  }

  const match = findPresetByExactName(presetName, deps.presets);

  if (!match) {
    throw new Error(`Preset "${presetName}" not found. Call search_presets first.`);
  }

  return resolveInsertObject({
    type: match.preset.type,
    data: match.preset.data,
    ...(args.position ? { position: args.position } : {})
  });
}
