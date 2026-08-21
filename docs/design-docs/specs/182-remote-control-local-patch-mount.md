# 182. Remote Control Local Patch Mount

**Status:** Ready for implementation

## Goal

Let an artist mount the currently open Patchies patch into an empty local
directory, edit represented code in a local editor, and have each save apply to
the live patch through normal undo/redo history.

The browser remains authoritative for patch content. The local `patchies` CLI
is one Mutating Client that requests changes through the embedded
`patchies-server` relay. Mounts survive browser reloads while the server stays
alive.

## Scope

V1 represents code-bearing objects only, starting with GLSL. It provides a
configuration-based adapter contract for later text-code objects.

V1 excludes editable patch-graph files, binary assets, non-empty mount paths,
background mounts without a reclaimed browser, and concurrent mutating clients.

## Artist Workflow

1. Choose **Enable Remote control** in the command palette.
2. Copy and run `patchies mount --token patchies://v1/<opaque-payload> --path
   ./spectral-garden` with an absent or empty directory.
3. The directory appears and receives the Patch Representation.
4. Saving `glsl-24/shader.frag` applies one `Apply remote file` undo command.
5. Browser edits, undo, and redo atomically update local files.
6. The command palette and Settings > Remote Control show state, the mount
   command, and **Disable and revoke access**.

## Remote Control Session

The Connection String is a versioned opaque value:

```text
patchies://v1/<base64url payload>
```

It contains the normalized instance URL and high-entropy bearer secret. The
server stores only a verifier and never logs the secret. The CLI authenticates
with `Authorization: Bearer`; non-loopback instances require HTTPS.

Enabling Remote control creates a session bound to the currently loaded patch.
It lasts until the artist disables it or the server exits. A session allows one
Mutating Client.

Every envelope contains:

```json
{
  "protocolVersion": 1,
  "sessionId": "opaque-server-session-id",
  "patchId": "browser-patch-id",
  "browserGeneration": "uuid-created-on-page-load",
  "operationId": "uuid-created-by-sender",
  "patchRevision": 42
}
```

After a reload, the browser automatically tries to reclaim its persisted
session. A successful reclaim gets a new Browser Generation, publishes an
Authoritative Snapshot before the CLI may write, and shows a reconnection
success toast. The relay rejects mismatched session, patch, generation, and
stale operations; it never retargets a write to another patch.

The handshake advertises protocol versions and coarse capabilities. V1 offers
mount/file sync. Future CLI and MCP operations use this envelope but v1 does
not define their catalog or fine-grained scopes.

## Relay Transport

The embedded Go server owns a custom versioned HTTP relay. It uses Echo as the
structured HTTP subrouter, embedded in the PocketBase process. Do not use
PocketBase record realtime subscriptions as the broker.

| Direction | Transport | Purpose |
| --- | --- | --- |
| Relay → browser | SSE | Deliver CLI operations to the authoritative browser |
| Relay → CLI | SSE | Deliver snapshots and browser representation events |
| Browser → relay | HTTP POST | Reclaim, snapshot, and operation acknowledgement |
| CLI → relay | Bearer-authenticated HTTP POST | Attach and submit Remote File Operations |

SSE uses relay sequence IDs and `Last-Event-ID` for resume. Patch Revision
orders patch content. The relay sends heartbeats, flushes events, retains a
bounded event buffer and terminal operation results, and only relays—the browser
alone mutates Patchies state.

## Patch Representation

The root has identity metadata, not a whole-patch index:

```text
patchies.json
glsl-24/
  patchies.object.json
  shader.frag
```

Tools discover represented objects by scanning directories. `patchies.json`
contains representation format/version and patch identity. Generated,
read-only `patchies.object.json` identifies object type, adapter version,
represented mappings, and content revision/hash. Metadata edits are restored,
not applied as mutations.

An object-owned Representation Adapter declaratively maps UTF-8 text files to
named node-data fields:

```ts
type RepresentationAdapter = {
  objectType: string;
  version: 1;
  files: Array<{ path: string; dataKey: string; language?: string }>;
};
```

The first adapter maps `glsl/shader.frag` to `node.data.code`. Its write uses
the normal GLSL code-commit path, preserving uniform/output derivation and run
revision updates. Custom encoders, binary assets, and editable metadata are
deferred. Deleting or renaming a represented file restores it; unknown files
are ignored with a diagnostic.

The default adapter set represents every node with a string `data.code` as
`code.js` and every node with a string `data.expr` as `expr.txt`. JS-expression
objects (`expr`, `filter`, `map`, `tap`, `scan`, `uniq`, and `peek`) use
`expr.js`. Object-specific adapters override those defaults when a
language-specific name is available: GLSL uses `shader.frag`; Hydra uses
`shader.js`; p5 and Shader Park use `sketch.js`; ChucK uses `code.ck`; Assembly
uses `code.asm`; and Csound uses `score.csd`.

## Synchronization and History

The browser sends an Authoritative Snapshot only on attach and reclaim. After
that baseline, it publishes revisioned per-object representation updates or
removals; it never sends the full graph for ordinary code edits. The CLI uses
atomic writes and suppresses its own watcher events, accepting saves only after
snapshot completion.

The watcher settles each path for about 200 ms and handles atomic-save rename
patterns. While disconnected it keeps only the latest settled value per file.
After a reclaim snapshot it submits each as a fresh Remote File Operation;
local content wins without replaying intermediate saves.

Each accepted local save creates exactly one `Apply remote file` history
command with the complete affected node-data snapshot. Undo and redo therefore
restore source and derived fields together. Browser edits, undo, and redo emit
atomic filesystem updates that the CLI never loops back into history.

For a failed write to an existing object, the CLI preserves the file and marks
it unsynced. When the browser removes an object, the CLI immediately removes
the directory and discards queued writes for it without recovery copies.

## Diagnostics and Verification

The command palette shows current status and last event, exposing an
expandable/copyable Session Trace only on demand. Server and CLI traces are
bounded and redacted: identifiers, path, event kind, duration, and outcome—no
credentials or file contents. The CLI writes readable stderr events and
supports `--json` for agents.

Verification has focused Go relay/CLI tests, browser adapter/history tests, and
one real integration harness that starts the embedded server, drives a browser
with Playwright, and uses a test CLI against a temporary watched directory.
Scenarios wait for explicit acknowledgements and final Patch Revision, never
sleeps, then assert browser, filesystem, and undo history converge.

The initial suite covers initial mount, rapid and atomic saves, reconnect and
reclaim with queued content, stale-generation rejection, object deletion, and
browser undo/redo mirroring.

## Delivery

`cli/` is an independent Go module; it and `server/` share the documented JSON
protocol rather than implementation imports. Every `v*` release publishes a
Release Pair for macOS, Linux, and Windows on amd64 and arm64:

- `patchies` — local CLI
- `patchies-server` — embedded Patchies server

The CLI installer verifies checksums and installs into `~/.local/bin` without
sudo, with a PowerShell equivalent for Windows. Direct downloads and `go
install` remain available. Users upgrade by rerunning the installer. Shared
release tags negotiate protocol compatibility; the combined release has no
`patchies` server alias.
