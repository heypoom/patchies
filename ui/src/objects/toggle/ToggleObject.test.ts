import { describe, expect, it } from 'vitest';

import { ToggleObject } from '$objects/toggle/ToggleObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

function createToggle(initialValue = false) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    value: initialValue
  };
  const updates: Array<{ name: string | number; value: unknown; options: unknown }> = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    setParam(indexOrName: number | string, value: unknown, options?: unknown) {
      values[String(indexOrName)] = value;
      updates.push({ name: indexOrName, value, options });
    },
    getParam(indexOrName: number | string) {
      return values[String(indexOrName)];
    }
  } as ObjectContext;

  const object = new ToggleObject('toggle-1', context);

  return { object, sent, updates, values };
}

const meta = (inletName = 'value'): MessageMeta => ({ source: 'source', inletName });

describe('ToggleObject', () => {
  it('flips stored state on bang and emits the new value', () => {
    const { object, sent, updates, values } = createToggle(false);

    object.onMessage({ type: 'bang' }, meta());

    expect(values.value).toBe(true);
    expect(updates).toEqual([{ name: 'value', value: true, options: { notifyUI: true } }]);
    expect(sent).toEqual([true]);
  });

  it('stores boolean messages directly and emits them', () => {
    const { object, sent, values } = createToggle(true);

    object.onMessage(false, meta());

    expect(values.value).toBe(false);
    expect(sent).toEqual([false]);
  });

  it('treats numbers greater than or equal to one as on', () => {
    const { object, sent, values } = createToggle(false);

    object.onMessage(0.5, meta());
    object.onMessage(1, meta());

    expect(values.value).toBe(true);
    expect(sent).toEqual([false, true]);
  });
});
