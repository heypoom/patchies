import { describe, expect, it } from 'vitest';

import type { ObjectContext } from '$lib/objects/v2/ObjectContext';
import type { MessageMeta } from '$lib/objects/v2/interfaces/text-objects';
import { resolveMessageInlet } from '$lib/objects/v2/resolve-message-inlet';
import { schemaFromNode } from '$lib/objects/schemas/from-v2-node';

import { MsgObject, type MsgData } from './MsgObject';

function createMsg(initialData: MsgData = {}, connectedTargetTypes: string[] = []) {
  const sent: unknown[] = [];
  const values: Record<string, unknown> = {
    message: 'bang',
    ...initialData
  };
  const updates: Array<{ updates: Record<string, unknown>; options: unknown }> = [];

  const context = {
    send(data: unknown) {
      sent.push(data);
    },
    getData() {
      return values;
    },
    getConnectedTargetTypes() {
      return connectedTargetTypes;
    },
    setData(nextValues: Record<string, unknown>, options?: unknown) {
      Object.assign(values, nextValues);
      updates.push({ updates: nextValues, options });
    }
  } as ObjectContext;

  return {
    object: new MsgObject('msg-1', context),
    sent,
    updates,
    values
  };
}

function edgeMeta(object: MsgObject, inletKey: string): MessageMeta {
  return {
    source: 'source-1',
    inletKey,
    outletKey: 'message-out',
    ...resolveMessageInlet(object.getInlets(), {
      source: 'source-1',
      inletKey,
      outletKey: 'message-out'
    })
  };
}

describe('MsgObject', () => {
  it('parses and emits sequential messages without mounting a Svelte view', () => {
    const { object, sent } = createMsg({ message: `bang, 42, { type: 'play' }` });

    object.onMessage({ type: 'bang' }, { source: 'button-1' });

    expect(sent).toEqual([{ type: 'bang' }, 42, { type: 'play' }]);
  });

  it('stores cold placeholder values and emits only when the hot inlet receives a value', () => {
    const { object, sent, updates, values } = createMsg({ message: 'note $1 $2' });

    object.onMessage(64, edgeMeta(object, 'message-in-1'));

    expect(sent).toEqual([]);
    expect(updates).toEqual([]);
    expect(values).not.toHaveProperty('inletValues');

    object.onMessage('C4', edgeMeta(object, 'message-in-0'));

    expect(sent).toEqual([[{ type: 'note' }, 'C4', 64]]);
    expect(updates).toEqual([]);
  });

  it('handles both UI-originated bangs and edge-routed hot inlet metadata', () => {
    const { object, sent } = createMsg({ message: 'play' });

    object.onMessage({ type: 'bang' }, { source: 'msg-1' });
    object.onMessage({ type: 'bang' }, edgeMeta(object, 'message-in-0'));

    expect(sent).toEqual([{ type: 'play' }, { type: 'play' }]);
  });

  it('uses connected target schemas to resolve ambiguous shorthand messages', () => {
    const { object, sent } = createMsg({ message: 'set 0 0.5' }, ['table']);

    object.onMessage({ type: 'bang' }, { source: 'msg-1' });

    expect(sent).toEqual([{ type: 'set', index: 0, value: 0.5 }]);
  });

  it('updates stored message text without triggering output', () => {
    const { object, sent, updates, values } = createMsg();

    object.onMessage({ type: 'set', value: { type: 'stop' } }, { source: 'source-1' });

    expect(sent).toEqual([]);
    expect(values.message).toBe(`{\n  type: 'stop',\n}`);
    expect(updates.at(-1)?.options).toEqual({ notifyUI: true });
  });

  it('exposes dynamic inlets with the saved indexed handle IDs', () => {
    const { object } = createMsg({ message: 'note $1 $3' });

    expect(object.getInlets().map((inlet) => inlet.handle)).toEqual([
      { handleType: 'message', handleId: 0 },
      { handleType: 'message', handleId: 1 },
      { handleType: 'message', handleId: 2 }
    ]);
    expect(edgeMeta(object, 'message-in-2')).toMatchObject({ inlet: 2, inletName: '$3' });
  });

  it('generates object metadata with the existing outlet and inlet handle shapes', () => {
    const objectSchema = schemaFromNode(MsgObject, 'interface');

    expect(objectSchema.inlets[0].id).toBe('message');
    expect(objectSchema.inlets[0].handle).toEqual({ handleType: 'message', handleId: 0 });
    expect(objectSchema.outlets[0].handle).toEqual({ handleType: 'message' });
    expect(objectSchema.handlePatterns?.inlet?.template).toBe('message-in-{index}');
  });
});
