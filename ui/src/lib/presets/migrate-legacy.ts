import type { Preset, PresetFolder, LegacyPresetsRecord } from './types';

/**
 * Migrate legacy presets (Record<name, {type, data}>) to new PresetFolder format
 *
 * Groups presets by their underlying type into folders:
 * - "glsl" folder for all GLSL presets
 * - "slider" folder for all slider presets
 * - etc.
 *
 * Preset names like "red.gl" become the preset name within the folder.
 */
export function migrateLegacyPresets(legacy: LegacyPresetsRecord): PresetFolder {
  const result: PresetFolder = {};

  for (const [presetName, { type, data }] of Object.entries(legacy)) {
    // Get or create the folder for this type
    if (!(type in result)) {
      result[type] = {};
    }
    const typeFolder = result[type] as PresetFolder;

    // Create the preset
    const preset: Preset = {
      name: presetName,
      type,
      data
    };

    typeFolder[presetName] = preset;
  }

  return result;
}

/**
 * Get a friendly display name for a preset type folder
 */
export function getTypeFolderDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    glsl: 'GLSL Shaders',
    hydra: 'Hydra',
    p5: 'P5.js',
    js: 'JavaScript',
    slider: 'Sliders',
    'expr-dsp': 'Expression DSP',
    chuck: 'ChucK',
    'ai-txt': 'AI Text',
    'tone.js': 'Tone.js',
    sonic: 'Sonic',
    elementary: 'Elementary',
    'canvas.dom': 'Canvas',
    'js-dsp': 'JS DSP',
    keyboard: 'Keyboard',
    orca: 'Orca',
    strudel: 'Strudel',
    textmode: 'Text Mode',
    three: 'Three.js',
    iframe: 'iFrame'
  };

  return displayNames[type] ?? type;
}
