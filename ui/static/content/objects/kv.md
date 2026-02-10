# kv

Persistent key-value storage for the patch. Data persists across sessions using IndexedDB.

## Creation

```
[kv]           → Unnamed store, scoped to this node
[kv mystore]   → Named store, shared across nodes with same name
```

## Input Messages

Send typed messages to perform storage operations:

| Command | Description |
|---------|-------------|
| `{type: "get", key: "..."}` | Retrieve value for key |
| `{type: "set", key: "...", value: ...}` | Store value at key |
| `{type: "delete", key: "..."}` | Remove key |
| `{type: "keys"}` | List all keys in store |
| `{type: "clear"}` | Remove all keys |
| `{type: "has", key: "..."}` | Check if key exists |

## Output Format

All outputs include an `op` field for routing:

```javascript
// get
{ op: 'get', key: 'mykey', value: 42, found: true }

// set
{ op: 'set', key: 'mykey', ok: true }

// delete
{ op: 'delete', key: 'mykey', deleted: true }

// keys
{ op: 'keys', keys: ['key1', 'key2'] }

// clear
{ op: 'clear', ok: true }

// has
{ op: 'has', key: 'mykey', exists: true }

// error
{ op: 'error', message: 'Error description' }
```

## Examples

### Counter

```
[loadbang] → [msg: {type: "get", key: "count"}] → [kv counter]
                                                      ↓
[+ 1] ← [js: x.found ? x.value : 0] ← [route: op=get]
  ↓
[msg: x => ({type: "set", key: "count", value: x})] → [kv counter]
```

### Named Store (shared state)

Multiple `[kv settings]` nodes share the same data:

```
[slider] → [msg: x => ({type: "set", key: "volume", value: x})] → [kv settings]

[loadbang] → [msg: {type: "get", key: "volume"}] → [kv settings] → [gain~]
```

## JSRunner API

In JavaScript nodes, use the `kv` object:

```javascript
// Get/set values
const count = (await kv.get("counter")) ?? 0;
await kv.set("counter", count + 1);

// Check existence
if (await kv.has("config")) {
  const config = await kv.get("config");
}

// List and clear
const keys = await kv.keys();
await kv.clear();

// Named stores
const settings = kv.store("settings");
await settings.set("theme", "dark");
```

## Binary Support

Both the object and JSRunner API support binary data:

```javascript
// Store binary data
await kv.set("image", blob);        // Blob
await kv.set("audio", arrayBuffer); // ArrayBuffer
await kv.set("data", uint8Array);   // Uint8Array

// Retrieve as stored
const blob = await kv.get("image");
```

## Notes

- Data is stored per-patch in IndexedDB
- Unnamed stores use the node ID as the store name
- Named stores are shared across all nodes with the same name
- Data persists until explicitly deleted or patch is removed
