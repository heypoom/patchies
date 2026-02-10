import { PatchStorageService } from './PatchStorageService';

/**
 * KVStore provides a scoped key-value storage interface.
 * This is the user-facing API exposed in JSRunner and used by the kv visual object.
 */
export class KVStore {
  private storeName: string;
  private storage: PatchStorageService;

  constructor(storeName: string) {
    this.storeName = storeName;
    this.storage = PatchStorageService.getInstance();
  }

  /**
   * Get a value by key.
   * @returns The value, or undefined if not found
   */
  async get(key: string): Promise<unknown> {
    return this.storage.kvGet(this.storeName, key);
  }

  /**
   * Set a value by key.
   * Supports any structured-cloneable value including Blob, ArrayBuffer, Uint8Array.
   */
  async set(key: string, value: unknown): Promise<void> {
    return this.storage.kvSet(this.storeName, key, value);
  }

  /**
   * Delete a key.
   * @returns true if the key existed and was deleted
   */
  async delete(key: string): Promise<boolean> {
    return this.storage.kvDelete(this.storeName, key);
  }

  /**
   * Get all keys in this store.
   */
  async keys(): Promise<string[]> {
    return this.storage.kvKeys(this.storeName);
  }

  /**
   * Clear all keys in this store.
   */
  async clear(): Promise<void> {
    return this.storage.kvClear(this.storeName);
  }

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    return this.storage.kvHas(this.storeName, key);
  }

  /**
   * Get a named store instance.
   * This allows switching to a different store namespace.
   */
  store(name: string): KVStore {
    return new KVStore(name);
  }
}

/**
 * Create a KVStore instance for a node.
 * Uses the nodeId as the store name by default.
 */
export function createKVStore(nodeId: string): KVStore {
  return new KVStore(nodeId);
}
