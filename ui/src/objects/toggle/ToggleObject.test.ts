import { describe, expect, it } from 'vitest';

import { ToggleObject } from '$objects/toggle/ToggleObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';

function createToggle(initialValue = false) {
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

  const object = new ToggleObject('toggle-1', context);

  return { object, sent, updates, values };
}

describe('ToggleObject', () => {
  it('flips stored state on bang and emits the new value', () => {
    const { object, sent, updates, values } = createToggle(false);

    object.onMessage({ type: 'bang' });

    expect(values.value).toBe(true);
    expect(updates).toEqual([{ updates: { value: true }, options: { notifyUI: true } }]);
    expect(sent).toEqual([true]);
  });

  it('handles click messages without resolved inlet metadata', () => {
    const { object, sent, values } = createToggle(false);

    object.onMessage({ type: 'bang' });

    expect(values.value).toBe(true);
    expect(sent).toEqual([true]);
  });

  it('stores boolean messages directly and emits them', () => {
    const { object, sent, values } = createToggle(true);

    object.onMessage(false);

    expect(values.value).toBe(false);
    expect(sent).toEqual([false]);
  });

  it('treats numbers greater than or equal to one as on', () => {
    const { object, sent, values } = createToggle(false);

    object.onMessage(0.5);
    object.onMessage(1);

    expect(values.value).toBe(true);
    expect(sent).toEqual([false, true]);
  });

  it('resolves edge messages sent through the legacy message-in handle', () => {
    const resolved = resolveMessageInlet(ToggleObject.inlets, {
      source: 'button-7',
      inletKey: 'message-in',
      outletKey: 'message-out'
    });

    expect(resolved).toEqual({ inlet: 0, inletName: 'value' });
  });
});
