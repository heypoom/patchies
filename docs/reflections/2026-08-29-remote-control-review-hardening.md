# Remote Control Review Hardening (2026-08-29)

## Objective

Close the remaining review findings for Remote Control without changing its
single-browser, single-mutating-client model. The work covered local filesystem
integrity, relay resource limits, stale client recovery, browser request
failure behavior, and patch identity transitions.

## Key Challenges & Solutions

Remote Control has three independent queues: filesystem events, relay events,
and browser coordinator work. A value recorded too early in any queue can hide
an unsynchronized edit. The watcher now advances its expected content only
after it queues the local change and only if a browser commit has not replaced
the expected value in the meantime. Queue saturation reports an explicit error.

Mutation authority must include both client identity and liveness. The relay
now distinguishes an active client event listener from an attachment that
never subscribed. Active listeners keep exclusive authority, while abandoned
attachments can be replaced after a grace period. The CLI retries during that
grace period instead of requiring another manual restart.

Patch identity cannot remain a callback-only concern. The coordinator now
records the patch ID bound to its credentials and storage entry. When the
active patch changes, it revokes the previous session before enabling and
publishing a snapshot for the current patch.

Malformed operations previously rejected the SSE handler promise before its
cursor advanced. Operation failures are now contained and reported at the
coordinator boundary, allowing later events on the same stream to proceed.

## What Could Be Better

The browser coordinator still combines session persistence, mutation ordering,
and patch-transition orchestration. The boundaries are clearer after the
earlier extraction, but future CLI and MCP operations may justify a dedicated
session lifecycle object.

The relay creation limiter is intentionally process-local. A future deployment
that distributes requests across processes will need a shared limiter or an
upstream rate limit.

## Action Items

- Keep all future represented-file validation on the shared plain-path-segment
  rule before filesystem joins.
- Treat browser patch identity as part of session credentials in future CLI and
  MCP operation designs.
- Add explicit operation failure reasons to the protocol if agents need more
  detail than a non-applied commit and local diagnostics.
