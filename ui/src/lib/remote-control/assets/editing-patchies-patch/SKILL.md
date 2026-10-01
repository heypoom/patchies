---
name: editing-patchies-patch
description: Edit a live Patchies patch through a Remote Control mount. Use to inspect the graph, create or delete objects, connect or disconnect wires, or edit shared patch code. Delegate object source edits to writing-patchies-object-code.
---

# Editing a Patchies Patch

The mount root is three directories above this skill. Resolve links relative to
this file and pass the mount root as `--path` to CLI commands. The browser owns
patch state and undo history; keep it open while editing.

## Inspect before editing

Read `graph.json` at the mount root before changing the patch. It is a read-only
projection of every node and edge, including objects without code files. Nodes
include `id`, `type`, `name`/`expression`, `position`, `sourcePaths`, and
`ports` (`ready`, `inlets`, `outlets`). Edges include their ID and all four
endpoints: `source`, `sourceHandle`, `target`, `targetHandle`.

`graph.json` is cached and can be stale while disconnected. Use a live query to
confirm the target objects and their current ports:

```sh
patchies graph --path <mount-root> --json
patchies node inspect <node-id> --path <mount-root> --json
```

Command responses wrap `result` with `operationId`, `fresh`, `browserGeneration`,
and `patchRevision`. Read the result and any error before proceeding.

## Create and delete objects

```sh
patchies node create glsl --path <mount-root> --position 100,200 --json
patchies node create 'osc~ 440' --path <mount-root> --json
patchies node delete <node-id> --path <mount-root> --json
```

Creation returns the assigned node ID, source paths, and port readiness. Optional
`--data '<JSON object>'` supplies initial data; omitted position uses the browser's
insertion position. Create objects through the CLI before editing their source.
Deletion accepts multiple node IDs and removes incident wires. Both operations
are undoable in the browser; undoing deletion restores the objects and wires.

For object source edits, read and use the sibling
[writing-patchies-object-code skill](../writing-patchies-object-code/SKILL.md).
It supplies the object's API/reference workflow and source-editing rules.

## Connect and disconnect wires

**Always read `graph.json` before editing `connections.txt` or issuing a wire
command. Never guess handle names.** Use exact IDs from the relevant inlet and
outlet lists, then confirm them with `node inspect` when they may have changed.
Handles are not predictable; objects such as `glsl` can generate dynamic handles
from their current code. After creating an object or changing its code, refresh
inspection and wait for `ports.ready` before wiring. A readiness failure requires
fresh discovery rather than constructing an ID from a type or index.

Each wire has four fields: source node ID, source outlet ID, target node ID,
and target inlet ID. CLI commands use the discovered endpoints:

```sh
patchies wire connect <source-id>:<source-handle-id> <target-id>:<target-handle-id> --path <mount-root> --json
patchies wire disconnect <source-id>:<source-handle-id> <target-id>:<target-handle-id> --path <mount-root> --json
```

Alternatively, read the current `connections.txt`, then edit only the requested
connections. Each line uses this DSL (substitute discovered IDs):

```text
<source-id>:<source-handle-id> -> <target-id>:<target-handle-id>
```

Added lines connect; removed lines disconnect those exact endpoints relative to
the last canonical baseline. Preserve unrelated lines. An empty file disconnects
all baseline wires; browser-only additions outside that baseline survive.
Blank lines and full-line `#` comments are allowed. JSON-quote IDs containing
whitespace or delimiters. Bare `@default` represents a null/default handle;
preserve it in existing wires and prefer concrete discovered IDs for new wires.
A literal handle named `@default` must be quoted.

One invalid declaration rejects the entire save and retains the text as unsynced.
Read the diagnostic, refresh graph/port discovery, then correct and save again.
Wire commands and each connection-file save produce normal undoable browser
history actions. Browser changes and undo/redo refresh both graph files.

## Shared patch code

[patch/](../../../patch/) is the shared code namespace, embedded in the patch.
For example, `patch/lib/math.js` maps to `patch://lib/math.js`, and
`patch/shaders/noise.glsl` maps to `patch://shaders/noise.glsl`. Put reusable JS
and GLSL here so objects can import shared code instead of copying it into each
object. Use the import API supported by the consuming object:

- Read [JavaScript modules](../../../references/docs/topics/js-modules.md)
  for JS modules and explicit `patch://` imports.
- Read [GLSL imports](../../../references/docs/topics/glsl-imports.md) for shader
  includes such as `#include "patch://shaders/noise.glsl"`.
- Read [Virtual filesystem](../../../references/docs/topics/virtual-filesystem.md)
  for namespace ownership and file access.

Remote Control syncs edits to existing represented files under `patch/` and
`objects/`. Create a missing shared file in the browser's Files sidebar first;
creating, deleting, or renaming a local file does not perform that action in the
patch. `user://` assets are outside this mount. Check consuming objects after a
shared-code edit; a successful sync does not prove the code runs correctly.

## Mount and recover

The running mount owns the private socket used by graph/node/wire commands.
Start it in a new or empty directory and provide the connection token when
prompted:

```sh
patchies mount --path <mount-root>
```

Transport interruptions reconnect automatically. Same-tab page reload reclaims
the session. After CLI termination, restart against the same directory and
session token:

```sh
patchies mount --resume --path <mount-root>
```

Resume scans and replays offline edits before refreshing from the browser.
Rejected or orphaned edits remain in private `.patchies/state.json`. New graph
commands require the browser to be connected. For a timeout or `outcome_unknown`,
inspect the live graph and `.patchies/last-command.json` before repeating the
command; an uncertain outcome does not mean the mutation was rolled back.
Explicit revocation or server restart ends the session. Keep tokens private.

Finish by querying the changed objects and wires, confirming file synchronization,
and reporting what changed and what runtime behavior was actually checked.
