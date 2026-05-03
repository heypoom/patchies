import { describe, expect, it } from 'vitest';

import { PackObject } from './PackObject';
import { validateMessageToObject } from '../../validate-object-message';
import { stringifyParamByType } from '../../parse-object-param';

import type { ObjectContext } from '../ObjectContext';
import type { MessageMeta } from '../interfaces/text-objects';

type SentMessage = {
  data: unknown;
  options: unknown;
};

function createPack(params: unknown[] = []) {
  const sent: SentMessage[] = [];
  const values: unknown[] = [];

  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    },
    setParam(indexOrName: number | string, value: unknown) {
      const index = typeof indexOrName === 'number' ? indexOrName : Number(indexOrName);
      values[index] = value;
    },
    getParam(indexOrName: number | string) {
      const index = typeof indexOrName === 'number' ? indexOrName : Number(indexOrName);
      return values[index];
    }
  } as ObjectContext;

  const object = new PackObject('pack-1', context);
  object.create(params);

  return { object, sent, values };
}

function meta(inlet: number): MessageMeta {
  return { source: 'source', inlet };
}

describe('PackObject', () => {
  it('defaults to two float inlets initialized to zero', () => {
    const { object, sent, values } = createPack();

    expect('getOutlets' in object).toBe(false);
    expect(object.getInlets()).toMatchObject([
      { name: '0', type: 'float', hot: true },
      { name: '1', type: 'float' }
    ]);

    object.onMessage({ type: 'bang' }, meta(0));

    expect(sent).toEqual([{ data: [0, 0], options: undefined }]);
    expect(values).toEqual([0, 0]);
  });

  it('emits current list without storing bang in the hot inlet', () => {
    const { object, sent, values } = createPack(['a', 'f']);

    object.onMessage('start', meta(0));
    object.onMessage(9, meta(1));
    object.onMessage({ type: 'bang' }, meta(0));

    expect(values).toEqual(['start', 9]);
    expect(sent).toEqual([
      { data: ['start', 0], options: undefined },
      { data: ['start', 9], options: undefined }
    ]);
  });

  it('updates cold inlets without output and emits the full list from the hot inlet', () => {
    const { object, sent } = createPack(['f', 's']);

    object.onMessage('kick', meta(1));
    expect(sent).toEqual([]);

    object.onMessage(12, meta(0));

    expect(sent).toEqual([{ data: [12, 'kick'], options: undefined }]);
  });

  it('treats numeric arguments as initialized float inlets', () => {
    const { object, sent, values } = createPack([440, 'symbol', 'float']);

    expect(object.getInlets()).toMatchObject([
      { name: '0', type: 'float', description: 'Stored float value 0' },
      { name: '1', type: 'symbol', description: 'Stored symbol value 1' },
      { name: '2', type: 'float', description: 'Stored float value 2' }
    ]);
    expect(values).toEqual([440, '', 0]);

    object.onMessage({ type: 'bang' }, meta(0));

    expect(sent).toEqual([{ data: [440, '', 0], options: undefined }]);
  });

  it('coerces anything messages to symbols on the hot symbol inlet', () => {
    const { object, sent } = createPack(['s', 'f']);

    object.onMessage({ type: 'hello' }, meta(0));

    expect(sent).toEqual([{ data: ['hello', 0], options: undefined }]);
  });

  it('allows bang through validation on the hot inlet', () => {
    const { object } = createPack(['f', 's']);
    const [hotFloat, coldSymbol] = object.getInlets();

    expect(validateMessageToObject({ type: 'bang' }, hotFloat)).toBe(true);
    expect(validateMessageToObject(20, hotFloat)).toBe(true);
    expect(validateMessageToObject('label', coldSymbol)).toBe(true);
  });

  it('supports any slots for arbitrary messages', () => {
    const { object, sent } = createPack(['f', 'a']);

    object.onMessage({ nested: true }, meta(1));
    object.onMessage(7, meta(0));

    expect(object.getInlets()).toMatchObject([
      { name: '0', type: 'float' },
      { name: '1', type: 'any' }
    ]);
    expect(sent).toEqual([{ data: [7, { nested: true }], options: undefined }]);
  });

  it('formats default symbol slots as s for node display', () => {
    const { object } = createPack(['f', 's', 'a']);
    const inlets = object.getInlets();

    expect(inlets[0].formatter).toBeUndefined();
    expect(inlets[1].formatter?.('')).toBe('s');
    expect(inlets[1].formatter?.('kick')).toBe('kick');
    expect(inlets[2].formatter?.(null)).toBe('a');
    expect(inlets[2].formatter?.({ nested: true })).toBe(null);
  });

  it('does not crash display formatting if stale params have the wrong type', () => {
    const { object } = createPack(['f']);
    const [floatInlet] = object.getInlets();

    expect(stringifyParamByType(floatInlet, 'stale-symbol', 0, { stickyPrecision: 2 })).toBe(
      'stale-symbol'
    );
  });
});
