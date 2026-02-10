import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { KVStore } from '$lib/storage';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';

// ─────────────────────────────────────────────────────────────────────────────
// KV Message Schemas
// ─────────────────────────────────────────────────────────────────────────────

/** Get a value by key */
export const KVGet = msg('get', { key: Type.String() });

/** Set a value at key */
export const KVSet = msg('set', { key: Type.String(), value: Type.Any() });

/** Delete a key */
export const KVDelete = msg('delete', { key: Type.String() });

/** List all keys */
export const KVKeys = msg('keys', {});

/** Clear all keys */
export const KVClear = msg('clear', {});

/** Check if key exists */
export const KVHas = msg('has', { key: Type.String() });

/**
 * Pre-wrapped matchers for use with ts-pattern.
 * Usage: match(msg).with(kvMessages.get, ({ key }) => ...)
 */
export const kvMessages = {
  get: schema(KVGet),
  set: schema(KVSet),
  delete: schema(KVDelete),
  keys: schema(KVKeys),
  clear: schema(KVClear),
  has: schema(KVHas)
};

// ─────────────────────────────────────────────────────────────────────────────
// KVObject
// ─────────────────────────────────────────────────────────────────────────────

/**
 * KVObject provides persistent key-value storage for patches.
 *
 * Creation: [kv] or [kv storename]
 * - Unnamed: scoped to node ID
 * - Named: shared across nodes with same name
 */
export class KVObject implements TextObjectV2 {
  static type = 'kv';
  static description = 'Persistent key-value storage';

  static inlets: ObjectInlet[] = [
    {
      name: 'command',
      type: 'message',
      description: 'Storage commands',
      messages: [
        { schema: KVGet, description: 'Get value by key' },
        { schema: KVSet, description: 'Set value at key' },
        { schema: KVDelete, description: 'Delete key' },
        { schema: KVKeys, description: 'List all keys' },
        { schema: KVClear, description: 'Clear all keys' },
        { schema: KVHas, description: 'Check if key exists' }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [{ name: 'result', type: 'message' }];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private store: KVStore | null = null;
  private storeName: string | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  create(params: unknown[]): void {
    // First param is the store name (optional)
    const name = params[0];
    this.storeName = typeof name === 'string' ? name : null;

    // Create the store - use store name if provided, otherwise use nodeId
    const storeKey = this.storeName ?? this.nodeId;
    this.store = new KVStore(storeKey);
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    if (meta.inletName !== 'command') return;
    if (!this.store) return;

    this.handleCommand(data);
  }

  private async handleCommand(data: unknown): Promise<void> {
    if (!this.store) return;

    try {
      const result = await match(data)
        .with(kvMessages.get, async ({ key }) => {
          const value = await this.store!.get(key);
          const found = value !== undefined;
          return { op: 'get' as const, key, value: found ? value : null, found };
        })
        .with(kvMessages.set, async ({ key, value }) => {
          await this.store!.set(key, value);
          return { op: 'set' as const, key, ok: true };
        })
        .with(kvMessages.delete, async ({ key }) => {
          const deleted = await this.store!.delete(key);
          return { op: 'delete' as const, key, deleted };
        })
        .with(kvMessages.keys, async () => {
          const keys = await this.store!.keys();
          return { op: 'keys' as const, keys };
        })
        .with(kvMessages.clear, async () => {
          await this.store!.clear();
          return { op: 'clear' as const, ok: true };
        })
        .with(kvMessages.has, async ({ key }) => {
          const exists = await this.store!.has(key);
          return { op: 'has' as const, key, exists };
        })
        .otherwise(() => {
          return { op: 'error' as const, message: `Unknown command: ${JSON.stringify(data)}` };
        });

      this.context.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.context.send({ op: 'error', message });
    }
  }
}
