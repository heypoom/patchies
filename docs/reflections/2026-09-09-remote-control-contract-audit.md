# Remote Control contract audit

## Objective

Align mount safety and recovery with the intended contract, then document the
implemented VFS-based architecture instead of the earlier object-only design.

## Key Challenges & Solutions

- A failed in-flight save could overwrite a newer queued save during reconnect.
  Requeue now preserves the latest value and collects not-yet-debounced edits.
- Canonical projections could erase pending or rejected local content. Preserve
  the local overlay until success, while letting browser deletion remove it.
- Unchanged and rejected saves both reported `applied: false`. An explicit error
  now distinguishes rejection and gives the CLI a visible unsynced state.
- Session idle expiry and nonempty mount acceptance contradicted the contract.
  Remove expiry and reject occupied destinations before attachment.

## What Could Be Better

Pending state is memory-only. Per-file rename is not a multi-file transaction.
Collecting uncaptured saves scans tracked files; measure this on large mounts.
Unit and fake-relay tests do not replace a real browser/CLI convergence harness.

## Action Items

- Add the combined integration harness before claiming end-to-end coverage.
- Measure large-mount scanning and introduce a dirty-path index if needed.
- Design resumable mounts separately rather than silently accepting old folders.
- Keep future installers, operation catalogs, and traces separate from delivered
  file-sync guarantees.
