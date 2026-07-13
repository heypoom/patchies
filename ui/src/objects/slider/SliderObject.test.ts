import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SliderObject } from './SliderObject';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';

function createSlider(initialData: Record<string, unknown> = {}) {
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

  const object = new SliderObject('slider-1', context);

  return { object, sent, updates, values };
}

describe('SliderObject', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('outputs the current value on create when runOnMount is enabled', () => {
    const { object, sent } = createSlider({ value: 12 });

    object.create();
    vi.advanceTimersByTime(100);

    expect(sent).toEqual([12]);
  });

  it('snaps numeric messages, stores the value, and emits it', () => {
    const { object, sent, updates, values } = createSlider({
      value: 0,
      min: 0,
      max: 10,
      defaultValue: 0,
      isFloat: false,
      step: 2
    });

    object.onMessage(7);

    expect(values.value).toBe(8);
    expect(updates).toEqual([{ updates: { value: 8 }, options: { notifyUI: true } }]);
    expect(sent).toEqual([8]);
  });

  it('outputs the current value on bang without changing params', () => {
    const { object, sent, updates } = createSlider({ value: 42 });

    object.onMessage({ type: 'bang' });

    expect(updates).toEqual([]);
    expect(sent).toEqual([42]);
  });

  it('resets to the default value and emits it', () => {
    const { object, sent, values } = createSlider({
      value: 8,
      min: 0,
      max: 10,
      defaultValue: 3
    });

    object.onMessage({ type: 'reset' });

    expect(values.value).toBe(3);
    expect(sent).toEqual([3]);
  });

  it('updates min and clamps the current value without emitting', () => {
    const { object, sent, values } = createSlider({
      value: 2,
      min: 0,
      max: 10,
      defaultValue: 0
    });

    object.onMessage({ type: 'setMin', value: 5 });

    expect(values.min).toBe(5);
    expect(values.value).toBe(5);
    expect(sent).toEqual([]);
  });

  it('sets value silently for setValue messages', () => {
    const { object, sent, values } = createSlider({
      value: 0,
      min: 0,
      max: 10,
      defaultValue: 0
    });

    object.onMessage({ type: 'setValue', value: 6 });

    expect(values.value).toBe(6);
    expect(sent).toEqual([]);
  });
});
