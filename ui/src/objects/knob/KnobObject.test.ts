import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnobObject } from './KnobObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';

function createKnob(initialData: Record<string, unknown> = {}) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    value: 0,
    min: 0,
    max: 100,
    defaultValue: 0,
    isFloat: false,
    step: undefined,
    ...initialData
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
    const { object, sent } = createKnob({ value: 12 });

    object.create();
    vi.advanceTimersByTime(100);

    expect(sent).toEqual([12]);
  });

  it('snaps numeric messages, stores the value, and emits it', () => {
    const { object, sent, updates, values } = createKnob({
      value: 0,
      min: 0,
      max: 10,
      defaultValue: 0,
      isFloat: false,
      step: 2
    });

    object.onMessage(7, meta());

    expect(values.value).toBe(8);
    expect(updates).toEqual([{ updates: { value: 8 }, options: { notifyUI: true } }]);
    expect(sent).toEqual([8]);
  });

  it('outputs the current value on bang without changing params', () => {
    const { object, sent, updates } = createKnob({ value: 42 });

    object.onMessage({ type: 'bang' }, meta());

    expect(updates).toEqual([]);
    expect(sent).toEqual([42]);
  });

  it('resets to the default value and emits it', () => {
    const { object, sent, values } = createKnob({
      value: 8,
      min: 0,
      max: 10,
      defaultValue: 3
    });

    object.onMessage({ type: 'reset' }, meta());

    expect(values.value).toBe(3);
    expect(sent).toEqual([3]);
  });

  it('updates max and clamps the current value without emitting', () => {
    const { object, sent, values } = createKnob({
      value: 8,
      min: 0,
      max: 10,
      defaultValue: 0
    });

    object.onMessage({ type: 'setMax', value: 5 }, meta());

    expect(values.max).toBe(5);
    expect(values.value).toBe(5);
    expect(sent).toEqual([]);
  });

  it('sets value silently for setValue messages', () => {
    const { object, sent, values } = createKnob({
      value: 0,
      min: 0,
      max: 10,
      defaultValue: 0
    });

    object.onMessage({ type: 'setValue', value: 6 }, meta());

    expect(values.value).toBe(6);
    expect(sent).toEqual([]);
  });
});
