import { Type } from '@sinclair/typebox';
import { match } from 'ts-pattern';

import type { ObjectContext } from '../ObjectContext';
import type { ObjectInlet, ObjectOutlet } from '../object-metadata';
import type { TextObjectV2, MessageMeta } from '../interfaces/text-objects';
import { KVStore } from '$lib/storage';
import { msg } from '$lib/objects/schemas/helpers';
import { schema } from '$lib/objects/schemas/types';
import { Get, SetKey } from '$lib/objects/schemas';

/** Delete a key */
export const KVDelete = msg('delete', { key: Type.String() });

/** List all keys */
export const KVKeys = msg('keys', {});

/** Clear all keys */
export const KVClear = msg('clear', {});

/** Check if key exists */
export const KVHas = msg('has', { key: Type.String() });

/** Set the store name */
export const KVSetStore = msg('setStore', { value: Type.String() });

/** Response for get operation */
export const KVGetResponse = Type.Object({
  type: Type.Literal('get'),
  key: Type.String(),
  value: Type.Union([Type.Any(), Type.Null()]),
  found: Type.Boolean()
});

/** Response for set operation */
export const KVSetResponse = Type.Object({
  type: Type.Literal('set'),
  key: Type.String(),
  ok: Type.Literal(true)
});

/** Response for delete operation */
export const KVDeleteResponse = Type.Object({
  type: Type.Literal('delete'),
  key: Type.String(),
  deleted: Type.Boolean()
});

/** Response for keys operation */
export const KVKeysResponse = Type.Object({
  type: Type.Literal('keys'),
  keys: Type.Array(Type.String())
});

/** Response for clear operation */
export const KVClearResponse = Type.Object({
  type: Type.Literal('clear'),
  ok: Type.Literal(true)
});

/** Response for has operation */
export const KVHasResponse = Type.Object({
  type: Type.Literal('has'),
  key: Type.String(),
  exists: Type.Boolean()
});

/** Response for setStore operation */
export const KVSetStoreResponse = Type.Object({
  type: Type.Literal('setStore'),
  value: Type.String(),
  ok: Type.Literal(true)
});

/** Error response */
export const KVErrorResponse = Type.Object({
  type: Type.Literal('error'),
  message: Type.String()
});

/**
 * Pre-wrapped matchers for use with ts-pattern.
 * Usage: match(msg).with(kvMessages.get, ({ key }) => ...)
 */
export const kvMessages = {
  get: schema(Get),
  set: schema(SetKey),
  delete: schema(KVDelete),
  keys: schema(KVKeys),
  clear: schema(KVClear),
  has: schema(KVHas),
  setStore: schema(KVSetStore)
};

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
        { schema: Get, description: 'Get value by key' },
        { schema: SetKey, description: 'Set value at key' },
        { schema: KVDelete, description: 'Delete key' },
        { schema: KVKeys, description: 'List all keys' },
        { schema: KVClear, description: 'Clear all keys' },
        { schema: KVHas, description: 'Check if key exists' },
        { schema: KVSetStore, description: 'Set store name' }
      ]
    },
    {
      name: 'store',
      type: 'string',
      description: 'Store name (optional)',
      hideInlet: true,
      hideTextParam: true,
      messages: [
        {
          schema: Type.Optional(Type.String()),
          description:
            'Shared store when using same store name. If empty, it becomes a local store.'
        }
      ]
    }
  ];

  static outlets: ObjectOutlet[] = [
    {
      name: 'result',
      type: 'message',
      description: 'Operation result',
      messages: [
        { schema: KVGetResponse, description: 'Get result with value and found flag' },
        { schema: KVSetResponse, description: 'Set confirmation' },
        { schema: KVDeleteResponse, description: 'Delete result with deleted flag' },
        { schema: KVKeysResponse, description: 'List of all keys' },
        { schema: KVClearResponse, description: 'Clear confirmation' },
        { schema: KVHasResponse, description: 'Existence check result' },
        { schema: KVSetStoreResponse, description: 'Store name change confirmation' },
        { schema: KVErrorResponse, description: 'Error message' }
      ]
    }
  ];

  readonly nodeId: string;
  readonly context: ObjectContext;

  private store: KVStore | null = null;

  constructor(nodeId: string, context: ObjectContext) {
    this.nodeId = nodeId;
    this.context = context;
  }

  private getStoreName(): string {
    const store = this.context.getParam('store');

    return typeof store === 'string' && store.length > 0 ? store : this.nodeId;
  }

  create(): void {
    // Note: context.initParams() is called before create() by ObjectService,
    // so inlet params (including 'store') are already initialized.
    // See parseObjectParamFromString for how inlet-indexed params are built.
    this.store = new KVStore(this.getStoreName());
  }

  onMessage(data: unknown, meta: MessageMeta): void {
    match(meta.inletName)
      .with('command', () => {
        if (this.store) {
          this.handleCommand(data).catch((error) => {
            const message = error instanceof Error ? error.message : String(error);

            this.context.send({ type: 'error', message });
          });
        }
      })
      .otherwise(() => {});
  }

  private async handleCommand(data: unknown): Promise<void> {
    if (!this.store) return;

    try {
      const result = await match(data)
        .with(kvMessages.get, async ({ key }) => {
          const value = await this.store!.get(key);
          const found = value !== undefined;

          return { type: 'get' as const, key, value: found ? value : null, found };
        })
        .with(kvMessages.set, async ({ key, value }) => {
          await this.store!.set(key, value);

          return { type: 'set' as const, key, ok: true };
        })
        .with(kvMessages.delete, async ({ key }) => {
          const deleted = await this.store!.delete(key);

          return { type: 'delete' as const, key, deleted };
        })
        .with(kvMessages.keys, async () => {
          const keys = await this.store!.keys();

          return { type: 'keys' as const, keys };
        })
        .with(kvMessages.clear, async () => {
          await this.store!.clear();

          return { type: 'clear' as const, ok: true };
        })
        .with(kvMessages.has, async ({ key }) => {
          const exists = await this.store!.has(key);

          return { type: 'has' as const, key, exists };
        })
        .with(kvMessages.setStore, ({ value }) => {
          this.context.setParam('store', value, { notifyUI: true });

          this.store = new KVStore(this.getStoreName());

          return { type: 'setStore' as const, value, ok: true };
        })
        .otherwise(() => {
          return { type: 'error' as const, message: `Unknown command: ${JSON.stringify(data)}` };
        });

      this.context.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.context.send({ type: 'error', message });
    }
  }
}
