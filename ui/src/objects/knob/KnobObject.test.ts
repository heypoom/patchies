import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnobObject } from './KnobObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

function createKnob(initialParams: unknown[] = []) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    value: 0,
    min: 0,
    max: 100,
    defaultValue: 0,
    isFloat: false,
    step: undefined
  };
  const updates: Array<{ name: string | number; value: unknown; options: unknown }> = [];

  for (const [index, value] of initialParams.entries()) {
    const name = KnobObject.inlets[index]?.name;
    if (name) values[name] = value;
  }

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

  const object = new KnobObject('knob-1', context);

  return { object, sent, updates, values };
}

const meta = (inletName = 'message'): MessageMeta => ({ source: 'source', inletName });

describe('KnobObject', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('outputs the current value on create when runOnMount is enabled', () => {
    const { object, sent } = createKnob([null, 12]);

    object.create();
    vi.advanceTimersByTime(100);

    expect(sent).toEqual([12]);
  });

  it('snaps numeric messages, stores the value, and emits it', () => {
    const { object, sent, updates, values } = createKnob([null, 0, 0, 10, 0, false, 2]);

    object.onMessage(7, meta());

    expect(values.value).toBe(8);
    expect(updates).toEqual([{ name: 'value', value: 8, options: { notifyUI: true } }]);
    expect(sent).toEqual([8]);
  });

  it('outputs the current value on bang without changing params', () => {
    const { object, sent, updates } = createKnob([null, 42]);

    object.onMessage({ type: 'bang' }, meta());

    expect(updates).toEqual([]);
    expect(sent).toEqual([42]);
  });

  it('resets to the default value and emits it', () => {
    const { object, sent, values } = createKnob([null, 8, 0, 10, 3]);

    object.onMessage({ type: 'reset' }, meta());

    expect(values.value).toBe(3);
    expect(sent).toEqual([3]);
  });

  it('updates max and clamps the current value without emitting', () => {
    const { object, sent, values } = createKnob([null, 8, 0, 10, 0]);

    object.onMessage({ type: 'setMax', value: 5 }, meta());

    expect(values.max).toBe(5);
    expect(values.value).toBe(5);
    expect(sent).toEqual([]);
  });

  it('sets value silently for setValue messages', () => {
    const { object, sent, values } = createKnob([null, 0, 0, 10, 0]);

    object.onMessage({ type: 'setValue', value: 6 }, meta());

    expect(values.value).toBe(6);
    expect(sent).toEqual([]);
  });
});
