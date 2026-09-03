# VFS Boundary Refactor

## Objective

Reduce `VirtualFilesystem` responsibility without changing its public interface or
Stage 1 Patch-file behavior.

## Key Challenges & Solutions

- Patch imports had grown beyond content validation into recursive copy,
  collision allocation, replacement-tree removal, and byte-budget planning.
  `PatchImportPlanner` now owns that complete atomic planning workflow against
  an immutable entry snapshot.
- Entry-map snapshots and global history commands were interleaved with VFS
  behavior. `VfsMutationCoordinator` now records those reversible transitions
  while the facade retains its existing provider-side effects.
- Tree lookup and snapshots were coupled to the facade's raw `Map`.
  `VfsEntryIndex` now owns the entry index, snapshots, and tree-path lookup.

## What Could Be Better

- Rename and delete still contain provider-specific effect orchestration in
  `VirtualFilesystem`. Moving those effects into typed mutation plans is the
  next useful extraction.
- Linked-folder traversal, permission handling, and hydration remain together
  in the facade because they share the Local Filesystem Access API lifecycle.
  Extract them only when their interface can be tested without exposing provider
  internals.

## Action Items

- Keep browser `DataTransfer` traversal in `drop-import.ts` and Files-panel
  collision prompts in the sidebar UI.
- Add new Patch import rules to `PatchImportPlanner`, not `VirtualFilesystem`.
- Extract linked-folder access and serialization only with a behavior-driven
  test seam.
