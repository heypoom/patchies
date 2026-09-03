# VFS Decomposition

## Objective

Turn `VirtualFilesystem` into a stable public facade whose collaborators own the
major VFS policies and state transitions, without changing observable behavior.

## Key Challenges & Solutions

- Directory traversal combined indexed entries with live linked-folder handles.
  `VfsDirectoryReader` now presents one listing, paging, search, metadata, and
  linked-file resolution boundary while keeping provider access injectable.
- Patch-file rules were split between direct writes, hydration quarantine, and
  import planning. `PatchFileOperations` now owns that lifecycle and continues to
  use `PatchImportPlanner` for immutable atomic import plans.
- Path mutations need complete collision checks before touching state.
  `VfsEntryIndex` now creates rename and deletion plans before applying them.
- Hydration mixed tree encoding with provider permission checks. `VfsTreeCodec`
  now handles only shape conversion, while `VfsPermissionTracker` owns local
  permission state and scanning.
- Synchronous history callbacks can start asynchronous provider writes.
  `VfsMutationCoordinator` now serializes those effects so rapid undo and redo do
  not reorder persisted changes.

## What Could Be Better

- The facade still coordinates local-file storage, replacement, and linked-folder
  lifecycle. This is intentional for now because these methods combine public API
  semantics, provider effects, history, and events; a future extraction should
  start from a typed local-resource operation rather than another pass-through
  wrapper.
- Provider capabilities are discovered with structural checks and casts. Typed
  provider capability interfaces would make those dependencies more explicit.

## Action Items

- Add new Patch-file validation and budget rules to `PatchFileOperations` or
  `PatchImportPlanner`, depending on whether they apply before or during staging.
- Add new tree calculations to `VfsEntryIndex`; keep the facade free of path-map
  scans.
- Keep tests at the `VirtualFilesystem` public API boundary unless a collaborator
  gains independently meaningful behavior that cannot be exercised there.
