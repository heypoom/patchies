# VFS JavaScript Modules

## Objective

Make embedded Patch JavaScript files editable and importable in every JSRunner-backed environment while preserving canvas-library precedence and the Stage 2 editor lifecycle.

## Key Challenges & Solutions

- Resolution had separate exact-name checks and a five-second dependency poll. `JSModuleResolver` now owns bare, relative, explicit VFS, npm, and URL resolution and reports missing imports immediately with structured attempts.
- Canvas libraries were identified by node IDs while VFS files have no nodes. Dependency traversal now uses canonical module sources and maps back to node IDs only when an importer needs to rerun.
- Main-thread, dedicated-worker, and render-worker runners start at different times. JSRunner now exposes a replayable module registry; dedicated workers subscribe to changes, and late render workers receive the complete snapshot before patch nodes hydrate.
- Saved edits and global undo share the VFS content-revision event. PatchRuntime updates the canonical source first, then reruns direct and transitive node importers in dependency order.

## What Could Be Better

- The browser Rollup package cannot run in the current Node test environment because it fetches its WebAssembly runtime. Resolver, registry, dependency, and runtime behavior are covered at their public seams, but a browser harness would add direct bundled-execution coverage.
- Rename and delete warnings use the browser confirmation dialog because the Files panel has no shared dependent-warning dialog yet.

## Action Items

- Keep new resolution rules in `JSModuleResolver`; do not add precedence checks to individual runtimes.
- Add browser-level coverage when the Files panel gains a rendered component test harness.
- Consider a shared Files mutation warning dialog if more dependency-aware file types are added.
