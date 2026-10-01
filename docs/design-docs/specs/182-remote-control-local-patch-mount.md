# 182. Remote Control Local Patch Mount

**Status:** File sync, resumable mounts, graph discovery, and undoable graph
control implemented. Delivery and diagnostic extensions remain deferred.

## Goal and scope

Mount the currently loaded patch into a local directory so artists can edit
source files in their preferred editor. The browser owns patch state, history,
and execution. The Go CLI requests changes through an in-memory relay embedded
in `patchies-server`, using Echo inside PocketBase.

The browser must remain open for live synchronization. Reloads reclaim the
session automatically; closing the page does not revoke the token. There is
one mutating client per session. This release supports existing-file saves and CLI graph operations. Background
patch execution and an MCP command catalog remain outside this scope.

## Artist workflow

1. Enable Remote Control from the command palette or Settings > Remote Control.
2. Copy `patchies mount --token patchies://v2/<opaque-payload> --path <new-folder-path>`.
3. Use an absent or empty directory. The CLI rejects nonempty destinations
   before attaching or projecting files, and rejects a symlink mount root.
4. Save a represented file locally to update the patch and run the object.
5. Browser edits, undo/redo, and structural changes update the mount.
6. Revoke access from the browser when finished.

Both `--token` and `--path` are optional: missing values are prompted for on
stdin. `--token-fd <descriptor>` reads credentials without placing them in
process arguments; it cannot be combined with `--token`. The copy screen keeps
the path placeholder. Keep tokens private, including shell history.
Interactive input is not a masked password field.

## Filesystem representation

The mount mirrors the browser VFS's Objects and Patch namespaces:

```text
objects/                    # obj://
  glsl-24/
    shader.glsl
  hydra-3/
    code.js
patch/                      # patch://
  lib/
    helpers.js
  empty-folder/
```

`VfsMountTree` reads the VFS index, maps namespaces, and includes implicit
parents and both roots. Object eligibility and filenames come from the shared
`ObjectFileProjection` and `object-code-files.ts`; there is no Remote Control
adapter registry. `user://` is excluded. Tools discover files by scanning
directories; there is no mount manifest, `object.json`, or graph file.

Patch files use the embedded UTF-8 provider and its limits: 256 KiB per file and
1 MiB total. Binary assets are not represented. Directories and nested paths
are preserved. A snapshot uses format `patchies.vfs-mount.v1`, a `patchId`,
and a flat `entries` list of `{path, kind, content?}`. Kind is `file` or
`directory`; file content is text.

Local saves update existing VFS files. New local files are not imported;
removal/rename of a tracked file restores its last expected content.
Browser creation, deletion, and rename are mirrored. Browser deletion also
discards pending local writes for that path/subtree, without recovery copies.
Snapshots prune unrepresented entries under the owned namespace roots.

The CLI validates namespace-relative paths and checks for symlinks before
writes/deletions. Individual file replacements use temporary-file rename.
Multi-entry commits and snapshots are not filesystem transactions and do not
roll back partial I/O failures. These checks are not a security boundary against
another local process concurrently replacing filesystem paths.

## Mount-only references

The CLI also projects a read-only `references/` companion, which is absent from
the browser VFS. `references/docs/` contains the existing human-facing Markdown
from `ui/static/content/`, preserving relative paths. `references/prompts/`
contains one Markdown file per registered object prompt, using the existing
prompt registry values without rewriting or maintaining copies. All registered
prompts are included so tools can discover object types beyond the current graph.
A short `references/README.md` explains selective discovery and writable paths.

Reference content is loaded lazily when publishing a snapshot and reused for
subsequent sync. Ordinary file edits do not resend it. CLI reference files have
read-only permissions and are excluded from local-save tracking; writes cannot
enter VFS history. Snapshots refresh/prune the generated references. This is
an exception to browser/mount tree parity, not a new VFS namespace.

The mount also installs `.agents/skills/writing-patchies-object-code/SKILL.md`.
This model-discoverable skill routes object-code tasks to the mounted prompts
and topic docs through relative links, without duplicating their API content
or advertising the internal harness's unavailable canvas tools. It explains
`objects/` and `patch/` ownership, existing-file-only sync, and runtime verification.
The skill is read-only and excluded from save tracking. Snapshot pruning owns
only this generated skill directory, preserving unrelated local agent skills
and configuration under `.agents/`.

## Session identity and lifetime

The connection string is `patchies://v2/<base64url-payload>`, containing the
normalized instance origin, session ID, and high-entropy secret. The CLI uses
Bearer authentication. HTTP is accepted only for `localhost` or a loopback IP;
other instance URLs require HTTPS. CLI requests do not follow redirects. The
relay stores a secret hash.

Sessions bind to one patch ID and last until explicit revocation or server
termination. There is no idle expiry or persisted server session store.
Creation is limited to 8 requests per minute per remote address and 128 live
sessions. An actively streaming mutating client has exclusive access. A client
that attaches but never opens its stream can be replaced after 5 seconds.

The browser persists reclaim credentials, making the command available after
reload. Reclaim verifies patch identity, establishes a fresh browser generation,
and publishes a snapshot before writes resume. Successful automatic restoration
shows a toast. Component disposal closes its connection without revoking.
Changing the loaded patch revokes the prior session and creates a new one
rather than retargeting the token.

The handshake checks `patchies.remote-control.v3`; it has no capability catalog.
Operations carry unique `operationId`, `browserGeneration`, `baseRevision`,
`path`, and `content`, or a typed `command`; connection saves also carry their
captured `baseline`. The relay validates generation and rejects future
revisions. Older revisions within a generation are allowed so local saves can
apply over newer browser content. The CLI checks snapshot patch IDs.
There is no backward-compatibility protocol adapter.

## Transport and ordering

Browser and CLI maintain SSE streams with sequence IDs and `Last-Event-ID`
replay. HTTP POSTs create/reclaim sessions, attach clients, publish snapshots,
submit operations, and publish canonical commits. Ordinary JSON requests have
a 30-second deadline; SSE stays open until cancellation. Reconnect delay is
500 ms. Replay, operation, and commit retention are bounded at 512 entries.
Replay gaps trigger snapshot recovery; slow consumers are disconnected rather
than silently dropping stream events.

The relay orders messages but does not mutate patches. The browser coordinator
serializes VFS reconciliation and remote writes in one queue. VFS notifications
are coalesced for 150 ms; the tracker compares current entries to its committed
baseline. Attach/reclaim/recovery sends a snapshot. Ordinary edits send per-path
replacements/deletions, not the full graph. Changed files are sent in full,
not as textual or JSON patches.

Browser edits and remote results use the same commit shape:

```json
{
  "commitId": "browser-generated-id",
  "operationId": "present-for-a-remote-save",
  "browserGeneration": "current-generation",
  "baseRevision": 41,
  "patchRevision": 42,
  "applied": true,
  "changes": [
    {
      "path": "objects/glsl-24/shader.glsl",
      "entry": {
        "path": "objects/glsl-24/shader.glsl",
        "kind": "file",
        "content": "void main() {}"
      }
    }
  ]
}
```

`entry: null` deletes a path. Represented changes advance revision once;
unchanged results have `applied: false` and no advance. Optional `error`
distinguishes failed saves from unchanged successful saves. Execution can fail
after source was written, so an error does not imply rollback or necessarily
`applied: false`.

A save normally uses one CLI operation POST and one browser commit POST.
The commit resolves the operation and publishes its content together; no
separate acknowledgement POST is needed. Retries can require more requests.
Malformed browser events are logged and consumed. When an operation ID can be
resolved, failed writes receive a terminal commit.

## Local conflicts, recovery, and history

The watcher handles nested directories and atomic-save rename patterns with a
200 ms settling delay. Canonical writes and expected-content tracking are
serialized to suppress echoes. Its change channel holds 32 events and reports
overflow rather than marking dropped changes synchronized.

The CLI keeps the latest value per path and one in-flight operation. Before
processing incoming state or requeueing a failed submission, it collects queued
changes and scans tracked files for saves not yet captured by debounce.
Newer pending content wins over an older in-flight request on reconnect.
Pending content is restored over browser projections until its operation
resolves. This implements local-wins for observed pending saves, not a
transactional lock against concurrent editor writes.

Failed saves print an `unsynced` warning and retain local content across browser
updates and reconnects. Editing and saving again retries. An unchanged save
without an error resolves normally. Pending/rejected state and canonical
baselines persist privately under `.patchies/`. Resume scans offline edits
before projecting a fresh snapshot; fresh mounts require an empty directory.

Remote writes use `VirtualFilesystem.writeCodeFile` and provider history.
Objects use the connected VFS run hook. There is no separate
`ApplyRemoteFileCommand` or guarantee that source and every derived runtime
field are restored as one node-data snapshot. Undo/redo notifications use the
same VFS change tracker and do not echo into new local operations.

## Implementation boundaries

- `RemoteControlSyncCoordinator`: browser lifecycle, identity, revision, and
  work queue; relay client, event stream, and VFS tracker are separate modules.
- `VfsMountTree`: shared projection and existing-file write/run path.
- Go relay: authentication, single-client ownership, ordering, and replay.
- CLI `MountSession`: attach/reconnect, pending operations, and projection.
- CLI mount package: validated filesystem writes and watcher suppression.

## Verification and delivery

Go tests cover relay ownership, ordering, replay, and CLI projection/recovery.
Browser unit tests cover coordinator events and VFS/history behavior. CLI tests
exercise alternating edits through a fake HTTP/SSE relay and temporary watched
directories; filesystem assertions use bounded polling. The combined harness
runs the production browser coordinator, VFS/history, Go relay, and CLI through
five recovery repetitions. It uses a headless port provider; it does not render
Svelte or prove runtime handle measurement in a real browser.

`cli/` and `server/` are independent Go modules sharing the JSON protocol,
not implementation imports. `just cli-build` builds the CLI and
`just cli-install` installs it into `~/.local/bin`. The release workflow ships
`patchies-server`, not a CLI/server release pair. The CLI uses Unix descriptor
APIs; Windows delivery is not complete.

Deferred: CLI/MCP catalogs and coarse capability discovery, structured
Session Trace UI, rendered-browser integration coverage, cross-platform CLI
releases and checksum-verifying installers. Graph commands already emit
structured JSON. Whole-tree filesystem transactions are not a guarantee.

## Resumable mounts and graph control

Recorded 2026-10-01. Poom confirmed that resume must preserve and replay offline
file edits, and that older CLI builds and mount layouts do not need backward
compatibility. These contracts replace the earlier ephemeral mount state and file-only
command surface.

### Recovery contract

Distinguish a temporary transport interruption, CLI process termination, and
browser reload. None should require a new mount directory or connection string
while the same relay session still exists. Explicit revocation and relay server
termination remain terminal; server-session persistence is outside this scope.

The running mount retries transport failures. Browser reload reclaims the same
patch-bound session with a fresh browser generation and publishes a ready
snapshot before accepting mutations. A transient reclaim or snapshot failure
must retain reclaim credentials and retry; only a definitive invalid/revoked
session clears them. Restore must wait for patch hydration and VFS readiness.
The existing same-tab session storage is sufficient for page reload; restoring
after closing the tab or restarting the browser is a separate feature.

Use explicit `patchies mount --resume --path <existing-mount>` with credentials
provided through the existing token input options. Do not save the connection
secret into mount metadata. Fresh mounts still reject arbitrary populated
directories. Resume requires valid metadata bound to the instance, session ID,
and patch ID, and refuses a second live mount process for the same directory.

Persist private mount state under `.patchies/`, excluded from file sync:

- Mount format, instance/session/patch identity, and last canonical baseline.
- Pending and rejected file contents, with their operation IDs and outcomes.
- Unresolved submitted commands and enough information to reconcile results.

Write state atomically with restrictive permissions. Persist intent before
submission and preserve local contents before applying an incoming projection.
A failed state write must stop mutation/projection before it can lose an edit.
Record the baseline even when pending content overlays the corresponding file;
the visible local file is not itself the canonical baseline.

On resume, scan tracked files against that saved baseline **before** applying
the fresh browser snapshot. Queue offline changes, then reconcile and restore
pending contents over the projection. If both sides edited an existing code
file, local pending content wins, matching current live-save behavior.
Unchanged local files refresh from the browser. An offline edit whose node or
file has disappeared is retained as an unsynced recovery item and reported;
it must not recreate a deleted node or disappear during snapshot pruning.
Unknown local files remain outside the import contract.

Operation-result recovery is required alongside reconnect. The relay retains queryable terminal outcomes across browser generations with
bounded retention and pins unresolved requests. On reclaim, unresolved requests
become terminal `outcome_unknown` results. An acknowledged-or-not node creation
is never blindly repeated. Expired outcomes
must be reported as unknown rather than interpreted as never submitted.
Reusing an operation ID with a different payload must fail. Reject
old-generation writes.

For an operation applied before reload without a published terminal result,
return `outcome_unknown` and preserve the request for inspection rather than
replaying it. Node creation uses stable `remote-<operationId>` IDs to make
inspection possible. The CLI consults retained outcomes and writes recovered
results to `.patchies/last-command.json` after the fresh projection. This does not promise
exactly-once execution across arbitrary browser crashes or server termination.
Unsubmitted code-file intent can be rebased to the fresh generation; ambiguous
submitted graph commands require outcome reconciliation first.

### One mount process, one local command endpoint

The long-running `mount` process owns the filesystem watcher, durable state,
relay attachment, and operation queue. It exposes a private Unix-domain socket
for short-lived CLI commands. Those commands use the existing mutating client;
they must not attach a second client to the relay.

Place a socket locator at `.patchies/socket.json`; always use a private runtime
directory under `/tmp` for the actual socket to avoid Unix socket path limits. Limit
socket access to the current user. Use a mount lock to distinguish a live owner
from a stale socket left after a crash. Unix support matches the current CLI;
Windows IPC remains separate delivery work.

Command surface (JSON output is always enabled):

```sh
patchies graph --path ./my-patch --json
patchies node inspect glsl-5 --path ./my-patch --json
patchies node create glsl --path ./my-patch --position 100,200 --json
patchies node delete glsl-5 --path ./my-patch --json
patchies wire connect glsl-5:video-out-out glsl-8:video-in-0-source-sampler2D --path ./my-patch --json
patchies wire disconnect glsl-5:video-out-out glsl-8:video-in-0-source-sampler2D --path ./my-patch --json
```

Creation uses the existing node factory, default data, and object-name
resolution. Generic text/audio expressions use a quoted name argument, such as
`node create "osc~ 440"`; `--data` accepts an initial JSON object through the same
creation path and rejects internal runtime keys.
Return the created node ID, source-file paths, and current handle readiness.
An omitted position uses the browser's existing insertion placement policy.

Graph queries return every node, including nodes without source files, and
every edge. Node entries include ID, type/object expression, position, source
paths, exact inlet/outlet IDs, and port kind. Edge entries include edge ID and
all four endpoint fields. Return browser generation and revision with queries.
Command responses include `fresh`, browser generation, and canonical revision.
Queries require the browser. The read-only `graph.json` file is a cached
projection and can become stale during disconnection; it is not a live query.

Mutation commands wait for a browser terminal result and canonical projection,
then print structured results to stdout; diagnostics go to stderr. A timeout
returns its operation ID and an unresolved outcome, not a claim of rollback.
While the browser is unavailable, fail new structural commands clearly;
continue retaining file edits for later replay. Do not silently queue destructive
commands based on stale graph data.

### Files for discovery and wiring

Keep `objects/` and `patch/` as VFS projections. Add mount-only companions,
alongside the existing `references/`:

```text
graph.json                 # read-only canonical nodes, ports, edges
connections.txt            # editable wire declarations
.patchies/                 # private state, lock, socket locator
```

`connections.txt` uses Poom's endpoint DSL, one connection per line:

```text
glsl-5:video-out-out -> glsl-8:video-in-0-source-sampler2D
```

This is a small line DSL, not YAML. Allow blank lines and full-line `#` comments.
Require both endpoint IDs, with JSON-quoted identifiers when an ID contains
whitespace, delimiters, or other reserved syntax. Reject malformed lines with
line-numbered errors. Treat repeated endpoint tuples as a single declaration.
The serializer and parser must round-trip arbitrary supported node/handle IDs.
Use bare `@default` for existing null-handle endpoints; a literal handle named
`@default` must be JSON-quoted. Preserve null endpoints in unchanged edges.
For new connections, accept `@default` only when the browser resolves an actual
default port unambiguously; otherwise require the discovered concrete handle.
Never infer a concrete port from an omitted or mistyped ID.

A settled save describes an edge-set change relative to the last canonical
connections baseline. Lines added locally request connections; lines removed
locally request disconnections of those exact four-field tuples. Preserve
browser-only additions that were absent from the local baseline. An empty file
disconnects the baseline's wires, not unseen concurrent browser additions.
Deleting the file itself restores it, matching tracked-file deletion semantics.

Preserve IDs and metadata of unchanged browser edges. Removing a tuple removes
all edges with that exact tuple; adding an already-present tuple is a no-op.
Sort canonical serialization deterministically. CLI wire commands and file
saves share the same validation and mutation service. Concurrent file edits
and command submissions must be serialized with their captured baselines;
a command must not overwrite a pending connections-file edit.

Validate the complete requested delta before mutating anything. Invalid syntax,
missing nodes/ports, incompatible port kinds, or a browser connection-policy
violation rejects the whole save. Preserve rejected text as unsynced and report
the offending line/endpoint. Browser edits and undo/redo refresh both companions
without echoing into new remote operations.

### Browser graph authority and history

Add a graph service at the canvas boundary and inject it into the Remote
Control coordinator. Reuse the node factory, canvas state accessors, history
commands, and connection policy. Do not introduce a separate graph owned by
the CLI, mutate arrays directly in the relay, or route through AI chat approval
actions to execute commands.

Node creation/deletion, wire connection/disconnection, and one connections-file
save each produce one normal undoable action. Node deletion includes attached
edges so undo restores both. A connections save groups additions and deletions
in one history command after complete validation. No-op requests add no history.
Undo/redo participates in canonical graph/file commits and revision tracking,
including changes to nodes with no code-file projection.

Discover actual current handles through the canvas/runtime integration, reusing
schema metadata for labels and type constraints. Existing AI handle-pattern
validation is insufficient: it can accept indexed ports that do not exist.
Validate outlet/inlet direction, actual existence, compatible port kind, and
the same policy used by canvas wiring, including AudioParam and acceptsFloat
exceptions. Dynamic ports must report readiness after initialization/code run;
queries must not invent handles from type patterns. Culling must not make ports
disappear from graph discovery. Reject a mutation with `ports_not_ready` when
the browser cannot yet validate it.

Extend the operation envelope with typed graph query/mutation payloads and
structured terminal results. Keep file and graph operations in the same
browser-authoritative queue. A graph mutation's result and its graph/source-file
projection belong to the same canonical revision. Update the mounted agent
skill to teach selective graph/port discovery, commands, connection-file saves,
and recovery once those features exist; reuse existing object references.

### Verification and remaining coverage

- Repeat browser → disk → browser edits through transport loss, CLI restart,
  page reload, and a pending operation; exercise offline saves and both-side
  edits without dropping the newer local intent.
- Reload while reclaim/snapshot requests fail transiently, then recover with
  the same session. Check patch hydration before the ready snapshot.
- Kill the CLI before submission, after submission, and after browser commit
  but before local acknowledgement. Verify outcome lookup and stable node IDs
  prevent duplicate creation. Exercise `outcome_unknown` explicitly.
- Query code and non-code nodes with fixed/dynamic ports; connect invalid or
  nonexistent handles, wrong-direction ports, incompatible types, and supported
  AudioParam/acceptsFloat exceptions. Include culled/uninitialized nodes.
- Create/delete nodes and connect/disconnect wires, then undo and redo in the
  browser. Verify restored incident edges and both filesystem companions.
- Test connection parsing/quoting, duplicates, null handles, invalid whole-file
  rejection, empty-file saves, concurrent browser additions, and concurrent
  commands plus pending file edits.
- Exercise socket lifecycle, stale-owner recovery, second-process rejection,
  wrong patch/session resume, corrupt/private state, state I/O failure, and
  revocation. Diagnostics must not disclose credentials.
- Run a combined browser/server/CLI recovery loop; existing isolated unit
  tests alone do not establish end-to-end reconnection behavior.

The implemented checks cover connection parsing/deltas and atomic validation,
normal graph history commands, publication retries without duplicate execution,
transient browser restoration, relay outcome retention, private state/socket
lifecycle, and CLI restart recovery. `ui/scripts/test-remote-control.sh` exercises
five combined loops: initial local save, browser edit, create/connect/file
unlink/undo/delete/undo, CLI SIGKILL, conflicting offline edits and resume, then
browser coordinator replacement and an immediate local save followed by another
browser edit. A watcher regression test checks saves made after an earlier scan,
including empty contents. Projection checks each writable file again before
replacement and preserves newly discovered intent.

The list above remains a coverage checklist, not a claim that every timing and
rendered-runtime scenario is automated. Real Svelte port initialization/culling,
full browser reload, arbitrary crash boundaries, and simultaneous external writes
during the final atomic rename still need broader verification. Filesystem
projection is not a whole-tree transaction. Relay process termination loses the
session; opening a new browser tab does not restore same-tab credentials.

### Mounted patch-editing skill

Mount `.agents/skills/editing-patchies-patch/SKILL.md` beside
`writing-patchies-object-code`. The patch-editing skill covers mount recovery,
graph/node/wire commands, read-only graph discovery, connection-file edits, and
shared code under `patch/`. It requires reading `graph.json` before every wiring
edit and using discovered current handles, including dynamic GLSL ports. Object
source edits delegate to the sibling object-code skill. Both generated skill
folders are read-only mount companions; refresh/pruning preserves unrelated
agent files and skills.
