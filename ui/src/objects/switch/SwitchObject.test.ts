import { describe, expect, it } from 'vitest';

import { SwitchObject } from '$objects/switch/SwitchObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';

function createSwitch(initialValue = false) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    value: initialValue
  };
  const updates: Array<{ updates: Record<string, unknown>; options: unknown }> = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    setData(nextValues: Record<string, unknown>, options?: unknown) {
      Object.assign(values, nextValues);
      updates.push({ updates: nextValues, options });
    },
    getData() {
      return values;
    }
  } as ObjectContext;

  const object = new SwitchObject('switch-1', context);

  return { object, sent, updates, values };
}

describe('SwitchObject', () => {
  it('stores and emits boolean values from view-originated toggle messages', () => {
    const { object, sent, updates, values } = createSwitch(false);

    object.onMessage(true);

    expect(values.value).toBe(true);
    expect(updates).toEqual([{ updates: { value: true }, options: { notifyUI: true } }]);
    expect(sent).toEqual([true]);
  });

  it('ignores non-boolean messages', () => {
    const { object, sent, updates, values } = createSwitch(false);

    object.onMessage({ type: 'bang' });

    expect(values.value).toBe(false);
    expect(updates).toEqual([]);
    expect(sent).toEqual([]);
  });
});
