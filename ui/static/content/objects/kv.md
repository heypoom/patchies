# kv

Persistent key-value storage object. Data persists across sessions using IndexedDB.

## Creation

```
[kv]           → Local store, scoped to this node
[kv mystore]   → Named store, shared across nodes with same name
```

## Local vs Named Stores

**Local store** (`[kv]`): Data is scoped to this specific node. Other `[kv]` nodes cannot access it.

**Named store** (`[kv mystore]`): Data is shared across all `[kv mystore]` nodes. Use this when multiple nodes need to read/write the same data.

## Examples

### Counter

```
[loadbang] → [msg: {type: "get", key: "count"}] → [kv counter]
                                                      ↓
[+ 1] ← [js: x.found ? x.value : 0] ← [route: type=get]
  ↓
[msg: x => ({type: "set", key: "count", value: x})] → [kv counter]
```

### Shared Settings

Multiple `[kv settings]` nodes share the same data:

```
[slider] → [msg: x => ({type: "set", key: "volume", value: x})] → [kv settings]

[loadbang] → [msg: {type: "get", key: "volume"}] → [kv settings] → [gain~]
```

## Binary Support

The kv object supports binary data (Blob, ArrayBuffer, Uint8Array).

## JavaScript API

For JavaScript objects (`js`, `worker`, `p5`, etc.), use the `kv` runtime API instead. 

See [Data Storage](/docs/data-storage) for details.
