# 63. Patch Storage

**Status**: Draft
**Created**: 2026-02-08

## Overview

Patch-local persistence system enabling patches to store and retrieve data across sessions. Provides both visual objects (`kv`, `db`) and JSRunner APIs for key-value and document storage.

## Goals

- Simple, intuitive API for common storage patterns
- Per-patch data isolation
- Support for JSON-serializable data and binary blobs
- Named stores for shared state within a patch
- Async-first design

## Deliverables

- `kv` object for key-value store
- `db` object for document store
- `kv()` method for key-value store in JS
- `db()` method for document store in JS

## Non-Goals (for v1)

- Cross-patch data access
- Complex query operators (beyond simple object matching)
- Data export/import (future VFS integration)
- Real-time sync or collaboration

## Architecture

```txt
┌─────────────────────────────────────────────────┐
│                  User-facing                     │
├──────────────────┬──────────────────────────────┤
│   kv object      │   db object                  │
│   (text object)  │   (text object)              │
├──────────────────┴──────────────────────────────┤
│              JSRunner API                        │
│         kv.get() / db.insert()                  │
├─────────────────────────────────────────────────┤
│            PatchStorageService                   │
│    (singleton, manages IndexedDB per patch)     │
├─────────────────────────────────────────────────┤
│              idb library                         │
│         (IndexedDB wrapper)                      │
└─────────────────────────────────────────────────┘
```

## Storage Backend

### Why IndexedDB?

- No practical size limits (localStorage caps at ~5-10MB)
- Native binary blob support (Blob, ArrayBuffer, Uint8Array)
- Structured cloning handles complex objects
- Wide browser support

### Database Structure

Each patch gets its own IndexedDB database: `patchies_${patchId}`

```txt
Database: patchies_abc123
├── Object Store: kv
│   └── Key: "${storeName}:${key}" → Value: any
├── Object Store: _collections (metadata)
│   └── Key: collectionName → Value: { created: timestamp }
└── Object Store: docs_${collectionName} (created dynamically)
    └── Key: documentId → Value: { _id, ...userData }
```

### Library Choice

Use `idb` by Jake Archibald:

- Tiny (~1KB gzipped)
- Promise-based API
- TypeScript support
- Well-maintained

## KV Object

### Creation Arguments

```txt
[kv]              → Unnamed, scoped to node ID
[kv mystore]      → Named, shared across nodes with same name
```

### Storage Keys

- Unnamed: `${nodeId}:${key}`
- Named: `${storeName}:${key}`

### Input Messages

Typed message format using TypeBox schemas:

| Message                                 | Description                   |
| --------------------------------------- | ----------------------------- |
| `{type: "get", key: "..."}`             | Retrieve value for key        |
| `{type: "set", key: "...", value: ...}` | Store value at key            |
| `{type: "delete", key: "..."}`          | Remove key                    |
| `{type: "keys"}`                        | List all keys in this store   |
| `{type: "clear"}`                       | Remove all keys in this store |
| `{type: "has", key: "..."}`             | Check if key exists           |

### Output Format (Tagged)

All outputs include `op` field for downstream routing:

```typescript
// get
{ op: 'get', key: string, value: unknown, found: boolean }

// set
{ op: 'set', key: string, ok: true }

// delete
{ op: 'delete', key: string, deleted: boolean }

// keys
{ op: 'keys', keys: string[] }

// clear
{ op: 'clear', ok: true }

// has
{ op: 'has', key: string, exists: boolean }

// error
{ op: 'error', message: string }
```

### Binary Support

`kv` accepts binary values directly:

```javascript
// In JSRunner
await kv.set("image", blob); // Blob
await kv.set("audio", arrayBuffer); // ArrayBuffer
await kv.set("data", uint8Array); // Uint8Array

const blob = await kv.get("image"); // Returns as stored
```

Text object accepts binary from upstream nodes (e.g., from canvas capture).

## DB Object

Document store with auto-generated IDs and simple querying.

### Creation Arguments

```txt
[db]              → Unnamed, scoped to node ID
[db mydb]         → Named, shared across nodes with same name
```

### Input Messages

| Message                           | Description                           |
| --------------------------------- | ------------------------------------- |
| `insert {collection} {doc}`       | Insert document, returns generated ID |
| `find {collection}`               | Find all documents in collection      |
| `find {collection} {query}`       | Find documents matching query         |
| `findOne {collection} {id}`       | Find document by ID                   |
| `update {collection} {id} {doc}`  | Update document (merge)               |
| `replace {collection} {id} {doc}` | Replace document entirely             |
| `delete {collection} {id}`        | Delete document by ID                 |
| `count {collection}`              | Count documents in collection         |
| `drop {collection}`               | Delete entire collection              |

### Collection Auto-Creation

Collections are created automatically on first `insert`. No explicit `createCollection` needed.

### Query Syntax (v1)

Simple object matching - document must contain all query fields with equal values:

```javascript
// Matches documents where author === "poom" AND status === "published"
{ author: "poom", status: "published" }
```

Future operators (v2+):

- `$gt`, `$gte`, `$lt`, `$lte` - Comparisons
- `$in`, `$nin` - Array membership
- `$contains` - String/array contains
- `$exists` - Field existence

### Output Format (Tagged)

```typescript
// insert
{ op: 'insert', collection: string, id: string }

// find
{ op: 'find', collection: string, docs: object[], count: number }

// findOne
{ op: 'findOne', collection: string, id: string, doc: object | null }

// update / replace
{ op: 'update', collection: string, id: string, ok: boolean }

// delete
{ op: 'delete', collection: string, id: string, ok: boolean }

// count
{ op: 'count', collection: string, count: number }

// drop
{ op: 'drop', collection: string, ok: true }

// error
{ op: 'error', message: string }
```

### Document Structure

All documents automatically get:

- `_id`: Auto-generated unique ID (nanoid)
- `_created`: Timestamp when inserted
- `_updated`: Timestamp when last modified

```javascript
// User inserts:
{ title: "Hello", content: "World" }

// Stored as:
{
  _id: "abc123xyz",
  _created: 1707350400000,
  _updated: 1707350400000,
  title: "Hello",
  content: "World"
}
```

## JSRunner API

Both `kv` and `db` are available in JSRunner context.

### KV API

```typescript
interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  store(name: string): KV; // Get named store instance
}

// Usage
const count = (await kv.get("counter")) ?? 0;
await kv.set("counter", count + 1);

// Binary
const imageBlob = await kv.get("snapshot");
await kv.set("snapshot", canvasBlob);
```

### DB API

```typescript
interface DB {
  insert(collection: string, doc: object): Promise<string>;
  find(collection: string, query?: object): Promise<object[]>;
  findOne(collection: string, id: string): Promise<object | null>;
  update(collection: string, id: string, doc: object): Promise<boolean>;
  replace(collection: string, id: string, doc: object): Promise<boolean>;
  delete(collection: string, id: string): Promise<boolean>;
  count(collection: string): Promise<number>;
  drop(collection: string): Promise<void>;
  store(name: string): DB; // Get named store instance
}

// Usage
const id = await db.insert("notes", { text: "Hello world" });
const notes = await db.find("notes", { author: "poom" });
await db.update("notes", id, { text: "Updated" });
await db.delete("notes", id);
```

### Named Stores in JSRunner

Use `kv.store()` and `db.store()` to access named stores:

```javascript
// Default kv/db use the node's internal store (scoped by nodeId)
await kv.set("key", value);
await db.insert("notes", { text: "hello" });

// Named stores - shared across nodes with same name
const shared = kv.store("mystore");
await shared.set("key", value);
await shared.get("key");

const sharedDb = db.store("mydb");
await sharedDb.insert("notes", { text: "hello" });
await sharedDb.find("notes");
```

The `store()` method returns a new KV/DB instance bound to that store name.

## Lifecycle & Cleanup

### Patch Deletion

When a patch is deleted:

1. Check if patch has any stored data via `patchStorage.hasPatchData(patchId)`
2. If yes, prompt user: "This patch has stored data. Delete it too?"
3. If confirmed, call `patchStorage.deletePatchData(patchId)`

### Node Deletion

- Unnamed stores: Data persists (keyed by nodeId that no longer exists)
  - Could add periodic cleanup for orphaned data
- Named stores: Data persists (may be used by other nodes)

### Browser Storage Limits

IndexedDB has generous limits but not infinite:

- Chrome: Up to 80% of disk space
- Firefox: Up to 50% of disk space
- Safari: 1GB+ with user prompt for more

Consider adding storage usage indicator in patch settings (future).

## Implementation Phases

### Phase 1: Core Infrastructure

- [x] Add `idb` dependency
- [x] Implement `PatchStorageService` singleton
- [x] KV operations (get, set, delete, keys, clear, has)
- [x] Basic IndexedDB setup per patch

### Phase 2: KV

- [x] Create `kv` text object (TextObjectV2)
- [x] Message parsing and dispatch
- [x] Tagged output format
- [x] Named store support
- [x] Binary blob support

### Phase 3: KV() for JS

- [x] Expose `kv()` in JSRunner context
- [x] Handle async operations
- [x] Named store configuration

### Phase 4: DB Object

- [ ] Document store operations
- [ ] Auto-generated IDs and timestamps
- [ ] Simple query matching
- [ ] Create `db` text object (TextObjectV2)

### Phase 5: DB() for JS

- [ ] Expose `db()` in JSRunner context

### Phase 6: Cleanup & Polish

- [ ] Patch deletion prompt
- [ ] Error handling and user feedback
- [ ] Add to object browser categories
- [ ] Documentation and examples

## Example Patches

### Counter (KV)

```
[loadbang] → [msg: {get: "count"}] → [kv counter]
                                         ↓
[+ 1] ← [js: x.found ? x.value : 0] ← [route: op=get]
  ↓
[msg: x => ({set: ["count", x]})] → [kv counter]
```

### Notes App (DB)

```
[text input] → [js: ({insert: ["notes", {text: inlet, ts: Date.now()}]})] → [db]
                                                                               ↓
[list view] ← [js: x.docs] ← [route: op=find] ←───────────────────────────────┘

[loadbang] → [msg: {find: "notes"}] → [db]
```

### JSRunner Example

```javascript
// Increment counter and log history
const count = (await kv.get("count")) ?? 0;
await kv.set("count", count + 1);

await db.insert("history", {
  count: count + 1,
  timestamp: Date.now(),
});

const recent = await db.find("history");
send({ count: count + 1, history: recent.slice(-10) });
```

## References

- Max `coll` object: Key-value with iteration, file I/O
- Max `dict` object: JSON-like nested structures, named sharing
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- idb library: https://github.com/jakearchibald/idb
