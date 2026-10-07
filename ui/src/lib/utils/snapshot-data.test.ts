import { reactive } from 'vue';
import { expect, test } from 'vitest';
import { snapshotData } from './snapshot-data';

test('snapshots nested reactive containers with cycles and shared native references', async () => {
  const buffer = new Uint8Array([1, 2]).buffer;
  const blob = new Blob(['hello']);
  const shared = { value: 1 };

  const source = reactive({
    list: [shared],
    map: new Map([['key', shared]]),
    set: new Set([shared]),
    buffer,
    bytes: new Uint8Array(buffer),
    blob,
    date: new Date(0),
    self: null as unknown
  });

  source.self = source;

  const copy = snapshotData(source);
  source.list[0].value = 2;

  expect(copy.list[0].value).toBe(1);
  expect(copy.map.get('key')).toBe(copy.list[0]);
  expect([...copy.set][0]).toBe(copy.list[0]);
  expect(copy.self).toBe(copy);

  expect(copy.bytes.buffer).toBe(copy.buffer);
  expect(copy.buffer).not.toBe(buffer);
  expect([...copy.bytes]).toEqual([1, 2]);
  expect(await copy.blob.text()).toBe('hello');
  expect(copy.date.getTime()).toBe(0);
  expect(() => structuredClone(copy)).not.toThrow();
});

test('rejects unsupported payloads instead of silently dropping them', () => {
  expect(() => snapshotData(reactive({ callback: () => {} }))).toThrow();
});
