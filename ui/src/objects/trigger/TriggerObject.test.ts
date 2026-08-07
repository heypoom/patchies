import { describe, expect, it } from 'vitest';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';
import { schemaFromNode } from '$lib/objects/schemas/from-v2-node';

import { TriggerObject, type TriggerData } from './TriggerObject';

function createTrigger(initialData: TriggerData = { types: ['b', 'n'] }) {
  const sent: Array<{ data: unknown; options: unknown }> = [];
  const values: Record<string, unknown> = { ...initialData };
  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    },
    getData() {
      return values;
    }
  } as ObjectContext;

  return {
    object: new TriggerObject('trigger-1', context),
    sent
  };
}

describe('TriggerObject', () => {
  it('dispatches matching outputs from right to left without mounting a Svelte view', () => {
    const { object, sent } = createTrigger({ types: ['a', 'b', 'n'] });

    object.onMessage(42, { source: 'button-1', inlet: 0 });

    expect(sent).toEqual([
      { data: 42, options: { to: 2 } },
      { data: { type: 'bang' }, options: { to: 1 } },
      { data: 42, options: { to: 0 } }
    ]);
  });

  it('filters outputs while preserving their original outlet indexes', () => {
    const { object, sent } = createTrigger({ types: ['n', 'b', 's'] });

    object.onMessage('hello', { source: 'button-1', inlet: 0 });

    expect(sent).toEqual([
      { data: 'hello', options: { to: 2 } },
      { data: { type: 'bang' }, options: { to: 1 } }
    ]);
  });

  it('accepts a UI-originated message without inlet metadata', () => {
    const { object, sent } = createTrigger({ types: ['b'] });

    object.onMessage('click', { source: 'trigger-1' });

    expect(sent).toEqual([{ data: { type: 'bang' }, options: { to: 0 } }]);
  });

  it('resolves the preserved edge-routed inlet handle', () => {
    expect(
      resolveMessageInlet(TriggerObject.inlets, {
        source: 'button-1',
        inletKey: 'message-in',
        outletKey: 'message-out'
      })
    ).toEqual({ inlet: 0, inletName: 'message' });
  });

  it('exposes dynamic outlets with the existing indexed message handle IDs', () => {
    const { object } = createTrigger({ types: ['b', 'n', 's'] });

    expect(object.getOutlets().map((outlet) => outlet.handle)).toEqual([
      { handleType: 'message', handleId: 0 },
      { handleType: 'message', handleId: 1 },
      { handleType: 'message', handleId: 2 }
    ]);
  });

  it('generates schema metadata without changing the single inlet handle ID', () => {
    const objectSchema = schemaFromNode(TriggerObject, 'interface');

    expect(objectSchema.inlets[0].handle).toEqual({ handleType: 'message' });
    expect(objectSchema.outlets[0].handle).toEqual({ handleType: 'message' });
    expect(objectSchema.hasDynamicOutlets).toBe(true);
    expect(objectSchema.handlePatterns?.outlet?.template).toBe('message-out-{index}');
  });
});
