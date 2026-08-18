# Remote Control Chat Tool Declarations

This is the bundled, bridge-supported subset of Patchies' in-app chat tools.
Use these names and argument shapes with `patchies-agent.ts request --tool` and
`--args`. The bridge rejects unsupported tools.

## Context tools

| Tool                      | Arguments                                                      | Result                                                                                                               |
| ------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `get_graph_nodes`         | `{}`                                                           | All canvas nodes with `id`, `type`, optional `name` and `position`, plus all edges with IDs, endpoints, and handles. |
| `get_viewport`            | `{}`                                                           | Viewport transform, visible canvas bounds, and center.                                                               |
| `get_object_data`         | `{ "objectId": "<node-id>" }`                                  | Full object data and all connected edges.                                                                            |
| `get_object_errors`       | `{ "objectIds": ["<node-id>"] }`                               | Map of object ID to deduplicated error messages.                                                                     |
| `get_object_logs`         | `{ "objectId": "<node-id>", "count": 10 }`                     | Up to 50 recent warning/error log entries for one object.                                                            |
| `get_object_instructions` | `{ "type": "glsl" }`                                           | Object-specific AI instructions, schema, and handle reference when available.                                        |
| `search_docs`             | `{ "query": "audio" }`                                         | Matching topic and object documentation metadata.                                                                    |
| `get_doc_content`         | `{ "kind": "object", "slug": "glsl" }`                         | Markdown for one topic or object documentation page.                                                                 |
| `list_vfs_files`          | `{ "path": ".", "offset": 0, "limit": 50 }`                    | One page of files and folders. `path` defaults to `.`; limit is capped at 100.                                       |
| `search_vfs_files`        | `{ "query": "shader", "path": ".", "offset": 0, "limit": 50 }` | One page of matching VFS paths.                                                                                      |
| `stat_vfs_file`           | `{ "path": "./notes.md" }`                                     | File metadata or directory information.                                                                              |
| `read_vfs_text`           | `{ "path": "./notes.md", "offset": 0, "length": 16384 }`       | Bounded textual content only; reads are capped at 32 KiB and binary files are refused.                               |

## Canvas tools

### `insert_object`

```json
{
  "type": "p5",
  "data": {},
  "position": { "x": 100, "y": 200 }
}
```

`type` and `data` are required. `position` is optional and must have finite `x`
and `y` values when present. Use this for one new object.

### `insert_objects`

```json
{
  "nodes": [
    {
      "type": "object",
      "data": { "name": "osc~" },
      "position": { "x": 0, "y": 0 }
    },
    { "type": "scope~", "data": {}, "position": { "x": 240, "y": 0 } }
  ],
  "edges": [
    {
      "source": 0,
      "target": 1,
      "sourceHandle": "audio-out-0",
      "targetHandle": "audio-in-0"
    }
  ]
}
```

`nodes` is required and non-empty. Each node needs `type` and `data`; `position`
is optional. Each edge refers to indexes in `nodes`, with optional handle IDs. Use
this only when all objects in the requested connected group are new.

### `update_object_data`

```json
{
  "nodeId": "<node-id>",
  "patch": { "frequency": 440 }
}
```

Both fields are required. `patch` merges into current object data. Do not send
internal fields such as `executeCode`, `initialized`, or keys beginning with `__`.

### `replace_object`

```json
{
  "nodeId": "<node-id>",
  "type": "glsl",
  "data": {}
}
```

All fields are required. This replaces one existing object with a new type and its
final data.

### `delete_objects`

```json
{ "nodeIds": ["<node-id>"] }
```

`nodeIds` is required, non-empty, and must not contain duplicates. Each ID must
exist at request time.

### `move_objects`

```json
{
  "positions": [{ "nodeId": "<node-id>", "position": { "x": 320, "y": 180 } }]
}
```

`positions` is required and non-empty. Every object ID must exist and appear only
once. Positions are final absolute canvas coordinates.

### `connect_edges`

```json
{
  "edges": [
    {
      "source": "<source-node-id>",
      "target": "<target-node-id>",
      "sourceHandle": "audio-out-0",
      "targetHandle": "audio-in-0"
    }
  ]
}
```

`edges` is required and non-empty. `source` and `target` must identify existing
objects. Handle IDs are optional but should be supplied when the connection needs
specific ports. Invalid handles are filtered and returned as warnings by Patchies.

### `disconnect_edges`

```json
{
  "edges": [
    { "edgeId": "<edge-id>" },
    { "source": "<source-node-id>", "target": "<target-node-id>" }
  ]
}
```

`edges` is required and non-empty. Use an exact `edgeId` when available. Otherwise
give `source` and `target`, optionally narrowed by `sourceHandle` and
`targetHandle`.
