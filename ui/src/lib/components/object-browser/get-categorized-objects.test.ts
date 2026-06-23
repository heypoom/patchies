import { describe, expect, it, vi } from 'vitest';

import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';

import { getCategorizedObjects } from './get-categorized-objects';

vi.mock('$lib/nodes/node-types', () => ({
  nodeNames: ['trigger', 'expr', 'filter', 'map', 'scan', 'tap', 'uniq']
}));

function getObjectNamesForCategory(categoryTitle: string): string[] {
  const enabledObjects = new Set(BUILT_IN_PACKS.flatMap((pack) => pack.objects));

  const category = getCategorizedObjects(true, enabledObjects).find(
    (group) => group.title === categoryTitle
  );

  return category?.objects.map((object) => object.name) ?? [];
}

describe('getCategorizedObjects', () => {
  it('includes enabled V2 text objects before object nodes mount', () => {
    expect(getObjectNamesForCategory('Control')).toEqual([
      'debounce',
      'delay',
      'float',
      'int',
      'kv',
      'loadbang',
      'metro',
      'patchbay',
      'queue',
      'recv',
      'send',
      'spigot',
      'stack',
      'throttle',
      'trigger'
    ]);

    expect(getObjectNamesForCategory('Transforms')).toEqual([
      '-',
      '*',
      '/',
      '+',
      'clip',
      'expr',
      'filter',
      'map',
      'pack',
      'scale',
      'scan',
      'select',
      'tap',
      'uniq',
      'uniqby',
      'unpack'
    ]);
  });
});
