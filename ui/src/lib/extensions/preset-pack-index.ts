import type { LegacyPresetsRecord, Preset, PresetFolder } from '$lib/presets/types';
import type { PresetPack } from '../../stores/extensions.store';

import { BUILT_IN_PRESET_PACKS } from './preset-packs';

export function getBuiltInPresetPackByPresetName(presetName: string) {
  return BUILT_IN_PRESET_PACKS.find((pack) => getPresetPackPresetNames(pack).includes(presetName));
}

export function getPresetPackPresetNames(pack: PresetPack): string[] {
  return [...pack.presets, ...Object.values(pack.presetFolders ?? {}).flat()];
}

export function getPresetPackDisplayItems(pack: PresetPack): string[] {
  const folderItems = Object.entries(pack.presetFolders ?? {}).map(
    ([folderName, presetNames]) => `${folderName} (${presetNames.length})`
  );

  return [...pack.presets, ...folderItems];
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

    for (const [folderName, presetNames] of Object.entries(pack.presetFolders ?? {})) {
      const subfolder: PresetFolder = {};

      for (const presetName of presetNames) {
        const preset = presets[presetName];
        if (!preset) continue;

        subfolder[presetName] = {
          name: presetName,
          description: preset.description,
          type: preset.type,
          data: preset.data
        } satisfies Preset;
      }

      if (Object.keys(subfolder).length > 0) {
        folder[folderName] = subfolder;
      }
    }

    if (Object.keys(folder).length > 0) {
      result[pack.name] = folder;
    }
  }

  return result;
}
