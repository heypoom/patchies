import type { LegacyPresetsRecord, Preset, PresetFolder } from '$lib/presets/types';

import { BUILT_IN_PRESET_PACKS } from './preset-packs';

export function getBuiltInPresetPackByPresetName(presetName: string) {
  return BUILT_IN_PRESET_PACKS.find((pack) => pack.presets.includes(presetName));
}

export function buildBuiltInPresetPackFolders(presets: LegacyPresetsRecord): PresetFolder {
  const result: PresetFolder = {};

  for (const pack of BUILT_IN_PRESET_PACKS) {
    const folder: PresetFolder = {};

    for (const presetName of pack.presets) {
      const preset = presets[presetName];
      if (!preset) continue;

      folder[presetName] = {
        name: presetName,
        description: preset.description,
        type: preset.type,
        data: preset.data
      } satisfies Preset;
    }

    if (Object.keys(folder).length > 0) {
      result[pack.name] = folder;
    }
  }

  return result;
}
