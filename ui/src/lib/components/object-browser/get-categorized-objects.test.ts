import { describe, expect, it, vi } from 'vitest';

import { BUILT_IN_PACKS } from '$lib/extensions/object-packs';

import { getCategorizedObjects } from './get-categorized-objects';

vi.mock('$lib/nodes/node-types', () => ({
  nodeNames: ['trigger', 'expr', 'filter', 'map', 'scan', 'tap', 'uniq', 'bchrn']
}));

function getObjectNamesForCategory(categoryTitle: string): string[] {
  const enabledObjects = new Set(BUILT_IN_PACKS.flatMap((pack) => pack.objects));

  const category = getCategorizedObjects(true, enabledObjects).find(
    (group) => group.title === categoryTitle
  );

  return category?.objects.map((object) => object.name) ?? [];
}

describe('getCategorizedObjects', () => {
  it('uses stable category ids separate from display titles', () => {
    const enabledObjects = new Set(BUILT_IN_PACKS.flatMap((pack) => pack.objects));

    const categories = getCategorizedObjects(true, enabledObjects);

    expect(categories.map((category) => category.id)).toContain('object-pack:midi');
    expect(new Set(categories.map((category) => category.id)).size).toBe(categories.length);
  });

  it('uses the declared object-pack order before object nodes mount', () => {
    expect(getObjectNamesForCategory('Control')).toEqual([
      'loadbang',
      'metro',
      'trigger',
      'spigot',
      'delay',
      'throttle',
      'debounce',
      'float',
      'int',
      'stack',
      'queue',
      'kv',
      'patchbay',
      'send',
      'recv'
    ]);

    expect(getObjectNamesForCategory('Transforms')).toEqual([
      'filter',
      'map',
      'tap',
      'scan',
      'select',
      'uniq',
      'uniqby',
      'pack',
      'unpack',
      'expr',
      '+',
      '-',
      '*',
      '/',
      '&&',
      '||',
      '!',
      '==',
      '!=',
      '<',
      '<=',
      '>',
      '>=',
      'scale',
      'clip'
    ]);

    expect(getObjectNamesForCategory('2D Graphics').at(-1)).toBe('bchrn');
  });
});
