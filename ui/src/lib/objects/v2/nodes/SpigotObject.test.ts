import { describe, expect, it } from 'vitest';

import { SpigotObject } from './SpigotObject';

import type { ObjectContext } from '../ObjectContext';
import type { MessageMeta } from '../interfaces/text-objects';

interface SentMessage {
  data: unknown;
  options: unknown;
}

function createSpigot() {
  const sent: SentMessage[] = [];
  const values: Record<string, unknown> = {
    control: false
  };

  const context = {
    send(data: unknown, options?: unknown) {
      sent.push({ data, options });
    },
    setParam(indexOrName: number | string, value: unknown) {
      values[String(indexOrName)] = value;
    },
    getParam(indexOrName: number | string) {
      return values[String(indexOrName)];
    }
  } as ObjectContext;

  const object = new SpigotObject('spigot-1', context);

  return { object, sent, values };
}

const meta = (inletName: string): MessageMeta => ({ source: 'source', inletName });

describe('SpigotObject', () => {
  it('treats zero as false and non-zero numbers as true', () => {
    const { object, sent, values } = createSpigot();

    object.onMessage?.(-1, meta('control'));
    object.onMessage?.('negative opens', meta('data'));
    object.onMessage?.(0, meta('control'));
    object.onMessage?.('zero blocks', meta('data'));
    object.onMessage?.(2, meta('control'));
    object.onMessage?.('positive opens', meta('data'));

    expect(values.control).toBe(true);
    expect(sent).toEqual([
      { data: 'negative opens', options: undefined },
      { data: 'positive opens', options: undefined }
    ]);
  });

  it('uses string control truthiness to open or close the gate', () => {
    const { object, sent, values } = createSpigot();

    object.onMessage?.('', meta('control'));
    object.onMessage?.('empty string blocks', meta('data'));
    object.onMessage?.('open', meta('control'));
    object.onMessage?.('non-empty string opens', meta('data'));

    expect(values.control).toBe(true);
    expect(sent).toEqual([{ data: 'non-empty string opens', options: undefined }]);
  });
});
