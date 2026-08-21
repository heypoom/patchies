# 182. Remote Control Local Patch Mount

**Status:** Core file sync implemented. Delivery and diagnostic extensions are deferred.

## Goal and scope

Mount the currently loaded patch into a local directory so artists can edit
source files in their preferred editor. The browser owns patch state, history,
and execution. The Go CLI requests changes through an in-memory relay embedded
in `patchies-server`, using Echo inside PocketBase.

The browser must remain open for live synchronization. Reloads reclaim the
session automatically; closing the page does not revoke the token. There is
one mutating client per session. This release supports existing-file saves,
not CLI/MCP graph operations or background patch execution.

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

The handshake checks `patchies.remote-control.v2`; it has no capability catalog.
Operations carry unique `operationId`, `browserGeneration`, `baseRevision`,
`path`, and `content`. The relay validates generation and rejects future
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
without an error resolves normally. Pending/rejected state is in memory only;
it is not restored after CLI termination. Files remain on disk after exit,
but a new mount invocation still requires a new or empty directory.

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
directories; filesystem assertions use bounded polling. These are not a single
real browser/server/CLI end-to-end harness.

`cli/` and `server/` are independent Go modules sharing the JSON protocol,
not implementation imports. `just cli-build` builds the CLI and
`just cli-install` installs it into `~/.local/bin`. The release workflow ships
`patchies-server`, not a CLI/server release pair. The CLI uses Unix descriptor
APIs; Windows delivery is not complete.

Deferred: CLI/MCP catalogs and coarse capability discovery, structured
`--json` output and Session Trace UI, a combined browser/server/CLI harness,
cross-platform CLI releases and checksum-verifying installers. Whole-tree
filesystem transactions and persistent unsynced-state recovery are not current
guarantees.
