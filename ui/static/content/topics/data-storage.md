# Data Storage

Patchies provides persistent storage APIs for JavaScript objects. It stores data for each patch in IndexedDB and keeps it across sessions.

## Key-Value Storage (kv)

The `kv` API stores persistent key-value data. It is available in [JavaScript Runner](/docs/javascript-runner) objects, such as `js`, `p5`, and `worker`.

### Node-Scoped Storage (Default)

By default, each node owns its `kv` storage. Other nodes cannot access it:

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

Use `kv.store("name")` to create a named store. All nodes that use the same name share the store:

```javascript
// In node A
const prefs = kv.store("prefs");
await prefs.set("volume", 0.8);

// In node B - same data!
const prefs = kv.store("prefs");
const volume = await prefs.get("volume"); // 0.8
```

Use a named store when you need to:

- Share configuration across multiple nodes.
- Create a central store that multiple nodes read and write.
- Store UI state that affects multiple parts of a patch.

### API Reference

All methods are asynchronous. They return Promises:

| Method | Description |
| ------ | ----------- |
| `kv.get(key)` | Get value by key (returns `undefined` if not found) |
| `kv.set(key, value)` | Set value at key |
| `kv.has(key)` | Check if key exists (returns boolean) |
| `kv.delete(key)` | Delete key (returns true if existed) |
| `kv.keys()` | Get all keys in the store |
| `kv.clear()` | Delete all keys in the store |
| `kv.store(name)` | Get a named store instance |

### Binary Data

KV storage supports binary data:

```javascript
// Store binary data
await kv.set("image", blob);        // Blob
await kv.set("audio", arrayBuffer); // ArrayBuffer
await kv.set("data", uint8Array);   // Uint8Array

// Retrieve as stored
const blob = await kv.get("image");
```

## Interop with Visual Objects

JavaScript and the visual [kv object](/docs/objects/kv) share named stores:

```javascript
// In a `js` node - access data from [kv prefs]
const prefs = kv.store("prefs");
const volume = await prefs.get("volume");

// Changes are visible to `[kv prefs]` nodes immediately
await prefs.set("theme", "dark");
```

JavaScript can access data that `[kv mystore]` sets through `kv.store("mystore")`. The visual object can access data that JavaScript sets in the same store.

## See Also

- [kv object](/docs/objects/kv) — Use visual key-value storage.
- [JavaScript Runner](/docs/javascript-runner) — Read JSRunner features and APIs.
