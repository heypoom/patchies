import { openDB, type IDBPDatabase } from 'idb';
import { get } from 'svelte/store';
import { currentPatchName } from '../../stores/ui.store';
import { logger } from '$lib/utils/logger';

const DB_VERSION = 1;
const KV_STORE = 'kv';

interface PatchStorageDB {
  kv: {
    key: string;
    value: unknown;
  };
}

/**
 * PatchStorageService manages IndexedDB storage per patch.
 * Each patch gets its own database with a kv object store.
 */
export class PatchStorageService {
  private static instance: PatchStorageService | null = null;

  /** Cache of open database connections by patch name */
  private dbCache: Map<string, IDBPDatabase<PatchStorageDB>> = new Map();

  /**
   * Get the database name for a patch.
   */
  private getDbName(patchName: string): string {
    return `patchies_${patchName}`;
  }

  /**
   * Get or create a database connection for a patch.
   */
  private async getDb(patchName: string): Promise<IDBPDatabase<PatchStorageDB>> {
    const cached = this.dbCache.get(patchName);
    if (cached) {
      return cached;
    }

    const dbName = this.getDbName(patchName);

    const db = await openDB<PatchStorageDB>(dbName, DB_VERSION, {
      upgrade(db) {
        // Create kv store if it doesn't exist
        if (!db.objectStoreNames.contains(KV_STORE)) {
          db.createObjectStore(KV_STORE);
        }
      }
    });

    this.dbCache.set(patchName, db);
    return db;
  }

  /**
   * Get the current patch name. Throws if no patch is loaded.
   */
  private getCurrentPatchName(): string {
    const patchName = get(currentPatchName);
    if (!patchName) {
      throw new Error('No patch is currently loaded');
    }
    return patchName;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KV Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a value from the KV store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to retrieve
   */
  async kvGet(storeName: string, key: string): Promise<unknown> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const fullKey = `${storeName}:${key}`;
    return db.get(KV_STORE, fullKey);
  }

  /**
   * Set a value in the KV store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to set
   * @param value - The value to store (must be structured-cloneable)
   */
  async kvSet(storeName: string, key: string, value: unknown): Promise<void> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const fullKey = `${storeName}:${key}`;
    await db.put(KV_STORE, value, fullKey);
  }

  /**
   * Delete a key from the KV store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to delete
   * @returns true if the key existed and was deleted
   */
  async kvDelete(storeName: string, key: string): Promise<boolean> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const fullKey = `${storeName}:${key}`;

    const existed = (await db.get(KV_STORE, fullKey)) !== undefined;
    await db.delete(KV_STORE, fullKey);
    return existed;
  }

  /**
   * Get all keys in a store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @returns Array of keys (without the store prefix)
   */
  async kvKeys(storeName: string): Promise<string[]> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const allKeys = await db.getAllKeys(KV_STORE);
    const prefix = `${storeName}:`;

    return allKeys
      .filter((k) => typeof k === 'string' && k.startsWith(prefix))
      .map((k) => (k as string).slice(prefix.length));
  }

  /**
   * Clear all keys in a store.
   * @param storeName - The store name (or node ID for unnamed stores)
   */
  async kvClear(storeName: string): Promise<void> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const tx = db.transaction(KV_STORE, 'readwrite');
    const store = tx.objectStore(KV_STORE);

    const allKeys = await store.getAllKeys();
    const prefix = `${storeName}:`;

    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith(prefix)) {
        await store.delete(key);
      }
    }

    await tx.done;
  }

  /**
   * Check if a key exists in the store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to check
   */
  async kvHas(storeName: string, key: string): Promise<boolean> {
    const patchName = this.getCurrentPatchName();
    const db = await this.getDb(patchName);
    const fullKey = `${storeName}:${key}`;
    const value = await db.get(KV_STORE, fullKey);
    return value !== undefined;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Check if a patch has any stored data.
   */
  async hasPatchData(patchName: string): Promise<boolean> {
    try {
      const db = await this.getDb(patchName);
      const count = await db.count(KV_STORE);
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete all data for a patch.
   */
  async deletePatchData(patchName: string): Promise<void> {
    // Close the cached connection if any
    const cached = this.dbCache.get(patchName);
    if (cached) {
      cached.close();
      this.dbCache.delete(patchName);
    }

    // Delete the database
    const dbName = this.getDbName(patchName);
    try {
      const { deleteDB } = await import('idb');
      await deleteDB(dbName);
      logger.info(`Deleted storage for patch: ${patchName}`);
    } catch (error) {
      logger.error(`Failed to delete storage for patch: ${patchName}`, error);
    }
  }

  /**
   * Close all database connections.
   */
  closeAll(): void {
    for (const db of this.dbCache.values()) {
      db.close();
    }
    this.dbCache.clear();
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): PatchStorageService {
    if (PatchStorageService.instance === null) {
      PatchStorageService.instance = new PatchStorageService();
    }
    return PatchStorageService.instance;
  }
}
