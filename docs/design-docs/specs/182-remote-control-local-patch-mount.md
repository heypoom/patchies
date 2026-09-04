# 182. Remote Control Local Patch Mount

**Status:** Implemented

## Goal

Let an artist mount the currently open Patchies patch into an empty local
directory, edit represented code in a local editor, and have each save apply to
the live patch through normal undo/redo history.

The browser remains authoritative for patch content. The local `patchies` CLI
is one Mutating Client that requests changes through the embedded
`patchies-server` relay. Mounts survive browser reloads while the server stays
alive.

## Scope

The first release represents code-bearing objects through a configuration-based
adapter contract. It excludes editable patch-graph files, binary assets, non-empty mount paths,
background mounts without a reclaimed browser, and concurrent mutating clients.

## Artist Workflow

1. Choose **Enable Remote control** in the command palette.
2. Copy and run `patchies mount --token patchies://v2/<opaque-payload> --path
   ./spectral-garden` with an absent or empty directory.
3. The directory appears and receives the Patch Representation.
4. Saving `glsl-24/shader.frag` applies one `Apply remote file` undo command.
5. Browser edits, undo, and redo atomically update local files.
6. The command palette and Settings > Remote Control show state, the mount
   command, and **Disable and revoke access**.

## Remote Control Session

The Connection String is a versioned opaque value:

```text
patchies://v2/<base64url payload>
```

It contains the normalized instance URL and high-entropy bearer secret. The
server stores only a verifier and never logs the secret. The CLI authenticates
with `Authorization: Bearer`; non-loopback instances require HTTPS.

Enabling Remote control creates a session bound to the currently loaded patch.
It lasts until the artist disables it or the server exits. A session allows one
Mutating Client. Session creation is throttled per remote address before the
global live-session cap is checked. An attached client with an active event
listener retains exclusive mutation authority; an attachment that never opens
its event stream may be replaced after a short grace period.

The session handshake advertises `patchies.remote-control.v2`. Mutating
requests carry the generation and revision information needed to serialize
them, for example:

```json
{
  "browserGeneration": "uuid-created-on-page-load",
  "operationId": "uuid-created-by-sender",
  "baseRevision": 42
}
```

After a reload, the browser automatically tries to reclaim its persisted
session. A successful reclaim gets a new Browser Generation, publishes an
Authoritative Snapshot before the CLI may write, and shows a reconnection
success toast. The relay rejects mismatched session, patch, generation, and
future-revision operations; it never retargets a write to another patch.

The handshake advertises protocol versions and coarse capabilities. V2 offers
mount/file sync. Future CLI and MCP operations use this envelope but v2 does
not define their catalog or fine-grained scopes.

## Relay Transport

The embedded Go server owns a custom versioned HTTP relay. It uses Echo as the
structured HTTP subrouter, embedded in the PocketBase process. Do not use
PocketBase record realtime subscriptions as the broker.

| Direction | Transport | Purpose |
| --- | --- | --- |
| Relay → browser | SSE | Deliver CLI operations to the authoritative browser |
| Relay → CLI | SSE | Deliver snapshots and browser representation events |
| Browser → relay | HTTP POST | Reclaim, snapshots, and canonical commits |
| CLI → relay | Bearer-authenticated HTTP POST | Attach and submit Remote File Operations |

SSE uses relay sequence IDs and `Last-Event-ID` for resume. Patch Revision
orders canonical patch content independently from transport sequence. The relay
flushes events and retains a bounded replay log. A slow or disconnected
consumer is disconnected and resumes from its last sequence; the relay never
silently drops an event. If the requested sequence is no longer retained, a
fresh client attachment makes the browser publish a new Authoritative Snapshot
before the CLI resumes writes.

The relay only coordinates transport and ordering. The browser alone mutates
Patchies state and publishes Canonical Commits. Both browser-originated edits
and accepted Remote File Operations use one commit envelope:

```json
{
  "commitId": "browser-generated-uuid",
  "operationId": "present-for-a-remote-file-operation",
  "browserGeneration": "current-browser-generation",
  "baseRevision": 41,
  "patchRevision": 42,
  "applied": true,
  "changes": [
    { "objectId": "glsl-24", "object": { "id": "glsl-24", "files": {} } }
  ]
}
```

An unapplied operation resolves with `applied: false`, no changes, and no
revision advance. Every applied commit advances Patch Revision by exactly one,
regardless of how many represented objects changed.

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
read-only `patchies.object.json` identifies the representation format, object
type, and represented filenames. Metadata edits are restored, not applied as
mutations.

An object-owned Representation Adapter declaratively maps UTF-8 text files to
named node-data fields:

```ts
type RepresentationAdapter = {
  objectType?: string;
  fileName: string;
  dataKey: string;
  runDataKey?: string;
};
```

The first adapter maps `glsl-24/shader.frag` to `node.data.code`. Its write uses
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

The browser synchronization surface remains a small coordinator facade, backed
by focused deep modules:

- `RemoteControlSyncCoordinator` owns session lifecycle, browser generation,
  Patch Revision, and the serialized mutation queue behind `enable`, `restore`,
  `disable`, `dispose`, and `notifyPatchChanged`.
- The relay client owns authenticated HTTP requests and opening the browser SSE
  response. The browser event stream owns cursors, reconnecting, and ordered
  delivery until disposal. The representation change tracker owns the committed
  representation baseline and creates object-level commit changes.
- Component teardown only disposes the local connection; it never revokes the
  persistent session.
- The CLI `MountSession` owns attachment, event replay, Patch Revision, the
  latest-per-file operation queue, watcher suppression, filesystem projection,
  and reconnect behavior behind one blocking `Run` operation.

Patchies UI code does not publish protocol events directly. It only notifies
the coordinator after authoritative patch state changes. Notifications are
coalesced and the coordinator diffs current representations against its last
committed baseline. Remote File Operations enter the same serialized work
queue, apply through the normal history command, and publish their canonical
result through the same commit endpoint.

Non-streaming browser and CLI relay requests have bounded deadlines. SSE
requests remain open until their caller cancels them. A malformed or otherwise
unresolvable browser event is reported locally and considered consumed, so it
cannot trap the stream in a replay loop. When an operation identity is valid,
the browser resolves rejected writes with a non-applied Canonical Commit.

The browser sends an Authoritative Snapshot on attach, reclaim, or replay-gap
recovery. After that baseline, every applied mutation emits a Canonical Commit;
ordinary code edits never send the full graph. A CLI-originated save therefore
uses one browser-to-relay commit POST, and Patchies-originated edits use that
same endpoint and event shape.

The CLI applies Canonical Commits atomically and marks expected filesystem
contents before writing, so its watcher cannot reinterpret canonical writes as
local operations. It accepts local saves only after snapshot completion. A
Canonical Commit for an in-flight Remote File Operation both updates the mount
and releases the next queued local save.

The watcher settles each path for about 200 ms and handles atomic-save rename
patterns. While disconnected it keeps only the latest settled value per file.
After replay or a reclaim snapshot it submits each as a fresh Remote File
Operation; local content wins without replaying intermediate saves. A request
that was created at an older revision remains valid within the same Browser
Generation: the coordinator serializes it after any earlier canonical commits
and applies the latest local content on top of current browser state.

Watcher backpressure is explicit. A full local-change queue reports an error
and leaves the expected canonical value unchanged, so the local edit is not
silently marked as synchronized. A settled read only replaces its expected
value when that value has not been superseded by a concurrent browser commit.

Each accepted local save creates exactly one `Apply remote file` history
command with the complete affected node-data snapshot. Undo and redo therefore
restore source and derived fields together. Browser edits, undo, and redo emit
atomic filesystem updates that the CLI never loops back into history.

For a failed write to an existing object, the CLI preserves the file and marks
it unsynced. When the browser removes an object, the CLI immediately removes
the directory and discards queued writes for it without recovery copies.

Switching the active patch while Remote Control is enabled revokes the previous
session before creating a session for the new patch. No snapshot or commit may
be published under a session created for another patch.

## Diagnostics and Verification

The command palette shows current status and last event, exposing an
expandable/copyable Session Trace only on demand. Server and CLI traces are
bounded and redacted: identifiers, path, event kind, duration, and outcome—no
credentials or file contents. The CLI writes readable stderr events and
supports `--json` for agents.

Verification uses Go relay/CLI tests, browser coordinator/adapter/history tests,
and one real integration harness that starts the embedded server, drives a
browser with Playwright, and uses a test CLI against a temporary watched directory.
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
