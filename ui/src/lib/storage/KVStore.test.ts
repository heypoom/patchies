import { reactive } from 'vue';
import { expect, test, vi } from 'vitest';
import { KVStore } from './KVStore';

const { storage } = vi.hoisted(() => ({ storage: { kvSet: vi.fn() } }));
vi.mock('./PatchStorageService', () => ({
  PatchStorageService: { getInstance: () => storage }
}));

test('captures reactive values synchronously before asynchronous storage completes', async () => {
  let finish!: () => void;

  const stored = new Promise<void>((resolve) => {
    finish = resolve;
  });

  storage.kvSet.mockReturnValueOnce(stored);

  const kv = new KVStore('node');
  const value = reactive({ items: [{ text: 'original' }] });
  const pending = kv.store('chat').set('history', value);
  value.items[0].text = 'edited';

  const [namespace, key, payload] = storage.kvSet.mock.calls[0];
  expect(namespace).toBe('chat');
  expect(key).toBe('history');
  expect(structuredClone(payload)).toEqual({ items: [{ text: 'original' }] });

  finish();
  await pending;
});
