import { openDB, type IDBPDatabase } from 'idb';
import { logger } from '$lib/utils/logger';

const DB_VERSION = 1;
const KV_STORE = 'kv';

/**
 * Build an unambiguous composite key using length-prefixing.
 * Format: `${storeName.length}:${storeName}:${key}`
 * This prevents collisions when storeName contains `:`.
 */
function buildKVKey(storeName: string, key: string): string {
  return `${storeName.length}:${storeName}:${key}`;
}

/**
 * Build the prefix for a store name (for iteration/filtering).
 * Format: `${storeName.length}:${storeName}:`
 */
function buildKVPrefix(storeName: string): string {
  return `${storeName.length}:${storeName}:`;
}

// Detect if we're in a worker context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isWorker = typeof self !== 'undefined' && typeof (self as any).document === 'undefined';

// Main thread only: Svelte store imports (loaded lazily to avoid worker issues)
let svelteGet: typeof import('svelte/store').get | null = null;
let currentPatchIdStore: import('svelte/store').Readable<string> | null = null;

// Promise that resolves when Svelte stores are ready (main thread only)
let storesReady: Promise<void> = Promise.resolve();

// Initialize Svelte stores in main thread only
if (!isWorker) {
  storesReady = Promise.all([
    import('svelte/store').then((m) => (svelteGet = m.get)),
    import('../../stores/ui.store').then((m) => (currentPatchIdStore = m.currentPatchId))
  ]).then(() => undefined);
}

interface PatchStorageDB {
  kv: {
    key: string;
    value: unknown;
  };
}

/**
 * PatchStorageService manages IndexedDB storage per patch.
 * Each patch gets its own database with a kv object store.
 *
 * Works in both main thread and workers:
 * - Main thread: reads patchId from Svelte store
 * - Workers: uses explicitly set patchId via setPatchId()
 */
export class PatchStorageService {
  private static instance: PatchStorageService | null = null;

  /** Cache of open database connections by patch name */
  private dbCache: Map<string, IDBPDatabase<PatchStorageDB>> = new Map();

  /** Explicitly set patchId (for workers) */
  private explicitPatchId: string | null = null;

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
   * Set the patch ID explicitly (for use in workers).
   */
  setPatchId(patchId: string): void {
    this.explicitPatchId = patchId;
  }

  /**
   * Get the current patch ID for storage scoping.
   * Uses explicit patchId if set, otherwise reads from Svelte store (main thread only).
   */
  private async getCurrentPatchId(): Promise<string> {
    if (this.explicitPatchId) {
      return this.explicitPatchId;
    }

    if (isWorker) {
      throw new Error('PatchStorageService: patchId not set. Call setPatchId() in worker context.');
    }

    await storesReady;

    if (!svelteGet || !currentPatchIdStore) {
      throw new Error('PatchStorageService: Svelte stores failed to initialize.');
    }

    return svelteGet(currentPatchIdStore);
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
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const fullKey = buildKVKey(storeName, key);

    return db.get(KV_STORE, fullKey);
  }

  /**
   * Set a value in the KV store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to set
   * @param value - The value to store (must be structured-cloneable)
   */
  async kvSet(storeName: string, key: string, value: unknown): Promise<void> {
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const fullKey = buildKVKey(storeName, key);

    await db.put(KV_STORE, value, fullKey);
  }

  /**
   * Delete a key from the KV store.
   * @param storeName - The store name (or node ID for unnamed stores)
   * @param key - The key to delete
   * @returns true if the key existed and was deleted
   */
  async kvDelete(storeName: string, key: string): Promise<boolean> {
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const fullKey = buildKVKey(storeName, key);

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
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const allKeys = await db.getAllKeys(KV_STORE);
    const prefix = buildKVPrefix(storeName);

    return allKeys
      .filter((k) => typeof k === 'string' && k.startsWith(prefix))
      .map((k) => (k as string).slice(prefix.length));
  }

  /**
   * Clear all keys in a store.
   * @param storeName - The store name (or node ID for unnamed stores)
   */
  async kvClear(storeName: string): Promise<void> {
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const tx = db.transaction(KV_STORE, 'readwrite');
    const store = tx.objectStore(KV_STORE);

    const allKeys = await store.getAllKeys();
    const prefix = buildKVPrefix(storeName);

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
    const patchName = await this.getCurrentPatchId();
    const db = await this.getDb(patchName);
    const fullKey = buildKVKey(storeName, key);
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
