import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/objects/object-definitions', () => ({
  getObjectAliases: () => []
}));

import {
  BUILT_IN_PACKS,
  BUILT_IN_PRESET_PACKS,
  disableAllPacks,
  disableAllPresetPacks,
  enabledPackIds,
  enabledPresetPackIds,
  enableAllExtensionPacks
} from './extensions.store';

describe('extensions store', () => {
  it('enables every object and preset pack for workshop setup', () => {
    disableAllPacks();
    disableAllPresetPacks();

    enableAllExtensionPacks();

    expect(get(enabledPackIds)).toEqual(BUILT_IN_PACKS.map((pack) => pack.id));
    expect(get(enabledPresetPackIds)).toEqual(BUILT_IN_PRESET_PACKS.map((pack) => pack.id));
  });
});
