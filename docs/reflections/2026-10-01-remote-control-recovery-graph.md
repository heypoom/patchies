# Remote Control recovery and graph commands

## Objective

Keep a patch mount usable across CLI termination and same-page browser reload,
preserve offline file edits, and let external agents inspect and edit the graph.

## Key Challenges & Solutions

- The filesystem is a projection, so visible pending text cannot serve as the
  canonical baseline. Private atomic state records canonical files, local intent,
  connection baselines, and interrupted projection intent separately. Resume
  scans disk before receiving the browser snapshot and preserves orphaned edits.
- A structural command can apply before its response reaches the CLI. The relay
  retains bounded terminal outcomes across browser generations and reports
  unresolved requests as `outcome_unknown`. Retained command results and the
  private last-command record identify created objects without blindly replaying
  commands.
- A mount already owns the relay attachment. Short-lived graph commands use its
  private Unix socket and operation queue rather than attaching another client.
- Existing AI handle patterns do not prove a port exists. The graph service uses
  actual canvas handle bounds and the shared connection policy; Remote Control
  disables culling so off-screen nodes remain measurable. Normal history commands
  implement node creation/deletion and grouped wire edits.
- The combined recovery loop exposed a save lost between a session-level scan
  and snapshot projection. Writable entries now check disk again immediately
  before replacement and retain newly observed saves, including empty contents.
  Five repeated real relay/CLI loops pass after this change.

## What Could Be Better

- The combined harness runs the browser coordinator with headless ports. It does
  not render Svelte, reload an actual browser page, or prove dynamic port timing.
- Projection is not a whole-tree transaction. An external write during the final
  atomic rename remains a race; crash coverage does not exhaust every boundary.
- The relay is in memory. Server termination loses sessions, and browser recovery
  relies on same-tab session storage. Windows IPC/delivery remains separate work.
- The full server suite crashes in PocketBase Collection JSON unmarshalling under
  the available Go 1.27 toolchain. Remote Control relay tests pass independently.

## Action Items

- Add rendered-browser coverage for dynamic handles, culling, and page reload.
- Expand fault injection around projection, operation submission, and publication.
- Investigate the PocketBase/toolchain recursion separately from Remote Control.
- Review cleanup of private runtime socket directories after SIGKILL.

## Incremental object IDs follow-up

Remote creation initially substituted request-derived IDs for canvas IDs. That
bypassed the global counter and broke the normal object identity contract. Remote
creation now delegates allocation to `NodeOperationsService`/`CanvasContext`,
sharing `<objectType>-<incrementalId>` IDs with browser creation. Operation IDs
remain separate, and the existing commit cache prevents a publication retry from
creating another object. Regression coverage checks sequential IDs across types,
undo/redo, duplicate publication, and the real CLI creation result.
