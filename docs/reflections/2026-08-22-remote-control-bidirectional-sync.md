# Remote Control Bidirectional Sync Rewrite (2026-08-22)

## Problem

Remote Control behaved like two independent one-way synchronizers. Browser
edits published object events while filesystem edits used an operation and
acknowledgement path. Each path advanced revision state and suppressed watcher
echoes differently. Timing changes could make one direction work while the
other stopped, and reconnects could leave the CLI attached to a stream that no
longer owned mutation authority.

## What changed

Both directions now converge through one browser-authored Canonical Commit.
The relay assigns its Patch Revision once and publishes the same
`commit.published` event to the CLI whether the source was Patchies or a local
file save. The former object-update and operation-acknowledgement endpoints no
longer exist.

The browser `RemoteControlSyncCoordinator` owns one serialized work queue for
patch notifications, remote operations, snapshots, revision changes, and SSE
reconnects. A remote file write still enters Patchies through
`ApplyRemoteFileCommand`, so it reruns the node and remains undoable. The code
editor emits lightweight change notifications; the coordinator coalesces them
and diffs representations rather than sending the patch graph per keystroke.

The CLI `MountSession` owns attachment, its event cursor, Patch Revision,
pending latest-per-file edits, one in-flight operation, watcher suppression,
and filesystem projection. Canonical content is registered with the watcher
before disk writes begin. This removes the race where a browser write could be
observed as a new local save.

SSE events now have monotonic IDs, bounded replay, heartbeats, and
`Last-Event-ID` resume. A client stream becomes live before the browser is
asked for a fresh authoritative snapshot, so reconnect never relies on a
stale relay-cached graph. Browser component teardown disposes its local stream
without revoking the persistent session; only the explicit Disable action
revokes it.

## Verification lesson

One-direction tests were insufficient. The important regression sequence is
filesystem edit, then Patchies edit, then another filesystem edit in the same
session. Browser and CLI tests now assert that exact alternation, including
revision progression and one browser commit POST per save. Future Remote
Control operations should enter the same coordinator/commit protocol instead
of adding another transport-specific state path.
