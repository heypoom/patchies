import { describe, expect, it } from 'vitest';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';
import { schemaFromNode } from '$lib/objects/schemas/from-v2-node';

import { CurveObject, type CurveData } from './CurveObject';

function createCurve(initialData: CurveData = {}) {
  const sent: unknown[] = [];
  const values: CurveData = { ...initialData };
  const updates: Array<{ updates: Partial<CurveData>; options: unknown }> = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    setData(nextValues: Partial<CurveData>, options?: unknown) {
      Object.assign(values, nextValues);
      updates.push({ updates: nextValues, options });
    },
    getData() {
      return values;
    }
  } as ObjectContext;

  return {
    object: new CurveObject('curve-1', context),
    sent,
    updates,
    values
  };
}

describe('CurveObject', () => {
  it('evaluates numeric messages without mounting a Svelte view', () => {
    const { object, sent } = createCurve({
      mode: 'linear',
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    });

    object.onMessage(0.25);

    expect(sent).toEqual([0.25]);
  });

  it('outputs the current flat breakpoint list on bang', () => {
    const { object, sent } = createCurve({
      points: [
        { x: 0, y: 0.2 },
        { x: 0.4, y: 0.8 },
        { x: 1, y: 0.5 }
      ]
    });

    object.onMessage({ type: 'bang' });

    expect(sent).toEqual([[0, 0.2, 0.4, 0.8, 1, 0.5]]);
  });

  it('resets points and notifies the view', () => {
    const { object, updates, values } = createCurve({
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 }
      ]
    });

    object.onMessage({ type: 'reset' });

    expect(values.points).toEqual([
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 }
    ]);
    expect(updates).toEqual([
      {
        updates: {
          points: [
            { x: 0, y: 0.5 },
            { x: 1, y: 0.5 }
          ]
        },
        options: { notifyUI: true }
      }
    ]);
  });

  it('clamps, sorts, and stores breakpoint lists while notifying the view', () => {
    const { object, updates, values } = createCurve();

    object.onMessage([1.4, -0.2, 0.25, 0.75]);

    expect(values.points).toEqual([
      { x: 0.25, y: 0.75 },
      { x: 1, y: 0 }
    ]);
    expect(updates.at(-1)?.options).toEqual({ notifyUI: true });
  });

  it('ignores odd breakpoint lists', () => {
    const { object, updates } = createCurve();

    object.onMessage([0, 0.5, 1, 0.5, 0.2]);

    expect(updates).toEqual([]);
  });

  it('preserves the existing message handle IDs in runtime metadata', () => {
    expect(
      resolveMessageInlet(CurveObject.inlets, {
        source: 'button-1',
        inletKey: 'message-in',
        outletKey: 'message-out'
      })
    ).toEqual({ inlet: 0, inletName: 'message' });

    const objectSchema = schemaFromNode(CurveObject, 'interface');
    expect(objectSchema.inlets[0].handle).toEqual({ handleType: 'message' });
    expect(objectSchema.outlets[0].handle).toEqual({ handleType: 'message' });
  });
});
