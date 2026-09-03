# 121. VFS JavaScript Modules

## Problem

JavaScript utilities can only be shared through `// @lib` nodes on the canvas. Those libraries are useful for visible, patch-specific live coding, but they cannot serve as small source files that travel with a saved patch.

The VFS also does not currently distinguish embedded patch content from external or browser-local files. File metadata is serialized with a patch, while local bytes and handles live in IndexedDB. That makes a path such as `user://utility.js` ambiguous: it may be a URL, filesystem link, or browser-local fallback rather than portable patch content.

JavaScript modules need:

- an explicit patch-owned namespace;
- predictable shorthand and relative resolution;
- editing from the Files panel;
- synchronization to every JSRunner environment;
- direct and transitive dependent reruns after a saved change.

## Solution

Store small embedded source files under `patch://` and import them through JSRunner alongside existing `// @lib` nodes.

```js
// Existing canvas library
import { random } from "utils";

// Patch-root shorthand
import { random } from "./utility";

// Explicit embedded path
import { random } from "patch://lib/utility.js";

// Explicit external VFS path
import { random } from "user://shared/utility.js";
```

`patch://` contents are UTF-8 text serialized under `files.patch`. `user://` continues to represent external or browser-local resources. Spec 52 defines namespace ownership, persistence limits, Files-panel behavior, and editing lifecycle.

This work ships in Stage 3 of the three-stage VFS delivery plan in spec 52. It builds on portable Patch files and the shared editor delivered in Stages 1 and 2, while remaining isolated from the GLSL resolver implementation.

## Why Keep Canvas and File Libraries

| | `// @lib` nodes | `patch://` modules |
| --- | --- | --- |
| Visible on canvas | Yes | No; lives in Files |
| Persistence | Patch node data | Embedded Patch VFS text |
| Best for | Patch-specific and live iteration | Stable utilities and nested module trees |
| Bare-name priority | First | Fallback after `// @lib` |

Both module types use the same Rollup pipeline, dependency graph, worker synchronization, and importer rerun behavior.

## Resolution Rules

JSRunner uses one canonical resolver for Rollup `resolveId`, dependency readiness, worker module synchronization, and dependent lookup. These surfaces must not implement separate precedence rules.

### Package and URL Imports

- `npm:<package>` keeps the existing npm resolution behavior.
- `http://` and `https://` keep the existing URL behavior.

### Bare Imports

For a bare import such as `import "utils"`:

1. Resolve an exact `// @lib utils` module.
2. If it does not exist, resolve the exact top-level Patch file `patch://utils.js`.
3. Otherwise report an unresolved import.

`import "utils.js"` checks an exact `// @lib utils.js` first, then `patch://utils.js`. Resolution is case-sensitive and root-only. It does not recursively search folders, perform fuzzy matching, or select a similarly named file.

### Relative Imports

Relative imports use standard filesystem semantics:

- Canvas-node code has no file path, so `./utility` resolves from the `patch://` root.
- `patch://lib/camera.js` importing `./utility` resolves beside the importer as `patch://lib/utility.js`.
- `user://lib/camera.js` importing `./utility` resolves beside the importer as `user://lib/utility.js`.
- `../` is supported but cannot escape the current namespace root.

The resolver first checks an exact extensionless path, then appends `.js`. `.mjs` is supported only when written explicitly.

### Explicit VFS Imports

`patch://` and `user://` imports resolve exact VFS paths. When an explicit path has no extension, JSRunner first checks the exact path and then appends `.js`.

Explicit `user://` modules remain importable but read-only in the first Files editor release. Patchies rereads a linked module whenever an importing node explicitly executes. Automatic reruns for changes made by an external filesystem editor are not part of this phase.

### User-Code VFS API

These import rules do not change the general user-code VFS API. `vfs.getUrl("./foo")`, `vfs.list(".")`, and other relative VFS helper paths continue to default to `user://`.

## Supported Patch Modules

The first release recognizes `.js` and `.mjs` Patch files as JavaScript modules. Only `.js` is inferred. Embedded-file encoding and size limits come from spec 52:

- UTF-8 text only;
- 256 KiB maximum per file;
- 1 MiB maximum total `patch://` content.

## Registration and Hydration

Patchies hydrates and registers all `patch://` files before node runtimes start. This prevents nodes from executing once with missing modules during patch load.

VFS JavaScript modules use canonical VFS paths as keys in JSRunner's module registry. Registration must populate:

- the main-thread JSRunner;
- the dedicated JS worker module snapshot;
- the render-worker JSRunner through the existing module update bridge.

The synchronization API must be explicit and replayable. A render worker initialized after Patch hydration still receives every registered Patch module before it executes importing code.

## Saving and Dependent Reruns

Unsaved CodeMirror drafts do not modify the module registry or rerun consumers. After a successful Save:

1. VFS commits the new embedded text and content revision.
2. JSRunner replaces the canonical module source in every environment.
3. The dependency graph finds importers using bare aliases, relative paths, or explicit canonical paths.
4. Direct and transitive importers rerun in dependency order.

The dependency graph is source-agnostic: a dependency may originate from a canvas `// @lib` node or a VFS path. Existing helpers that require a source node ID must be generalized rather than assigning fake node IDs to files.

Global undo of a saved edit restores the previous module source and triggers the same synchronization and dependent-rerun flow. Rename and delete warn when dependents are known, but Patchies does not rewrite import source text automatically.

## Failure Behavior

Resolution failures return a structured error instead of polling for five seconds or silently substituting an empty generated program. The error includes:

- the original specifier;
- the importing node or VFS path;
- canonical paths attempted;
- which resolution categories were attempted (`// @lib`, relative Patch, explicit VFS, npm, or URL).

Errors appear in the existing virtual console/runtime error surface. Inline file-editor diagnostics are deferred.

When a saved module fails to resolve, bundle, or execute, dependent nodes report the new error and retain their previous working runtime or visual output where the owning runtime supports last-known-good state. Invalid source remains saveable because users may intentionally persist work in progress.

## Files Editor

Patch JavaScript files open in the Files panel using a module-specific CodeMirror configuration:

- JavaScript parsing and import/export support;
- mixed GLSL and HTML parsing;
- Patchies API completions consistent with a `js` object;
- no node-specific Run command or Shift+Enter execution;
- no fake node ID or node-data history event.

Spec 52 owns the editor header, explicit Save behavior, dirty navigation guard, global history integration, namespace drop behavior, creation, export, and size validation.

## Compatibility

Existing `user://` files are not converted into Patch modules. Existing `// @lib` behavior remains valid and wins bare-name conflicts.

The saved-patch migration adds an empty `files.patch` tree when absent. Browser-local user file data and filesystem handles remain under `user://`; their IndexedDB keys become patch-ID-scoped as specified in spec 52.

## Verification

Test observable resolution and lifecycle behavior through public APIs and runtime outcomes:

1. Exact `// @lib` wins over a same-named top-level Patch module.
2. Bare, relative, explicit Patch, explicit User, npm, and URL imports resolve with the documented precedence.
3. Relative imports use the importer directory and cannot escape the namespace root.
4. Extension inference checks exact paths before `.js` and never infers `.mjs`.
5. Hydration registers Patch modules before importer execution in main-thread, dedicated-worker, and render-worker environments.
6. Saving and global undo synchronize source and rerun direct and transitive dependents once.
7. Unsaved drafts do not update or rerun consumers.
8. Missing imports fail promptly with structured diagnostics.
9. Existing `// @lib` and `user://` imports remain compatible.
