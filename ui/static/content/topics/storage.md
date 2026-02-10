# Storage

Patchies provides persistent storage APIs for JavaScript objects. Data is stored per-patch using IndexedDB and persists across sessions.

## Key-Value Storage (kv)

The `kv` API provides simple key-value storage. It's available in `js` and `p5` objects.

> **Note**: `kv` is not yet available in `worker` nodes.

### Node-Scoped Storage (Default)

By default, `kv` is scoped to the current node. Each node has its own isolated storage:

```javascript
// Store data - only this node can access it
await kv.set("counter", 42);
await kv.set("config", { theme: "dark", volume: 0.8 });

// Retrieve data
const count = await kv.get("counter"); // 42
const missing = await kv.get("nonexistent"); // undefined

// Use nullish coalescing for defaults
const value = (await kv.get("counter")) ?? 0;
```

### Named Stores (Shared)

Use `kv.store("name")` to create a named store that's shared across all nodes using the same name:

```javascript
// In node A
const settings = kv.store("settings");
await settings.set("volume", 0.8);

// In node B - same data!
const settings = kv.store("settings");
const volume = await settings.get("volume"); // 0.8
```

This is useful for:
- Sharing configuration across multiple nodes
- Creating a central data store that multiple nodes read/write
- Persisting UI state that affects multiple parts of your patch

### API Reference

All methods are async and return Promises:

| Method | Description |
|--------|-------------|
| `kv.get(key)` | Get value by key (returns `undefined` if not found) |
| `kv.set(key, value)` | Set value at key |
| `kv.has(key)` | Check if key exists (returns boolean) |
| `kv.delete(key)` | Delete key (returns true if existed) |
| `kv.keys()` | Get all keys in the store |
| `kv.clear()` | Delete all keys in the store |
| `kv.store(name)` | Get a named store instance |

### Binary Data

KV storage supports binary data types:

```javascript
// Store binary data
await kv.set("image", blob);        // Blob
await kv.set("audio", arrayBuffer); // ArrayBuffer
await kv.set("data", uint8Array);   // Uint8Array

// Retrieve as stored
const blob = await kv.get("image");
```

## Interop with Visual Objects

Named stores are shared between JavaScript and the visual [kv object](/docs/objects/kv):

```javascript
// In a `js` node - access data from [kv settings]
const settings = kv.store("settings");
const volume = await settings.get("volume");

// Changes are visible to `[kv settings]` nodes immediately
await settings.set("theme", "dark");
```

This works both ways - data set via `[kv mystore]` is accessible via `kv.store("mystore")` in JavaScript, and vice versa.

## See Also

- [kv object](/objects/kv) - Visual object for key-value storage
- [JavaScript Runner](/docs/javascript-runner) - JSRunner features and APIs
