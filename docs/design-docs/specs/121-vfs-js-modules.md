# 121. VFS JavaScript Modules

> Status: Core VFS modules implemented; single VFS module system and canvas mirrors planned

## Problem

JavaScript utilities were originally shared through `// @lib` nodes whose source and identity lived in canvas node data. Patch JavaScript modules later added a second source model under `patch://`. Keeping both models gives modules two owners, two persistence paths, and competing resolution rules.

The `@lib` declaration also duplicates information already present in a Patch file path. It can disagree with a filename, requires special rename behavior, and makes an otherwise ordinary JavaScript file depend on a source comment for importability.

JavaScript modules need:

- one canonical source and identity under `patch://`;
- predictable root-relative, relative, and explicit resolution;
- editing from Files or an optional canvas mirror;
- synchronization to every JSRunner environment;
- direct and transitive dependent reruns after committed changes.

## Solution

Every Patch `.js` or `.mjs` file is a JavaScript module. Its canonical VFS path is its only source and module identity. Inline canvas `js` objects remain executable scripts and do not register importable modules.

```js
// patch://utils.js
export const random = () => Math.random();

// patch://visual/camera.js
export const camera = {};
```

```js
// Patch-root shorthand
import { random } from "utils";
import { camera } from "visual/camera";

// Explicit embedded path
import { camera } from "patch://visual/camera.js";

// Explicit external VFS path
import { shared } from "user://shared/utility.js";
```

`patch://` contents are UTF-8 text serialized under `files.patch`. `user://` continues to represent external or browser-local resources. Spec 52 defines namespace ownership, persistence limits, Files behavior, and the shared editing lifecycle.

The core VFS module support shipped in Stage 3 of spec 52. Removing the parallel canvas-library system and adding canvas file mirrors is a follow-up built on that resolver, the portable Patch namespace, and the shared editor. It remains isolated from the GLSL resolver implementation.

## One Module System

The Patch VFS owns every importable user module. There is no canvas-library registry, source directive, or precedence rule. `// @lib` is an ordinary inert comment with no parser or runtime behavior.

Inline canvas `js` objects are executable scripts. They retain their normal ports, Run behavior, timers, and runtime lifecycle, but another source cannot import them. Creating an importable module starts by creating a Patch JavaScript file.

## Canvas File Mirrors

Dragging a Patch `.js` or `.mjs` file from Files onto the canvas creates an editor-only mirror. The mirror stores the canonical VFS path and never stores a competing source copy. Creating or importing a file does not place a mirror automatically.

At most one canvas mirror may reference a file. Dropping the same file again selects and focuses the existing mirror. The mirror displays the full Patch-relative path so same-named files in different folders remain distinguishable.

A mirror uses the existing library-style code UI, with these behaviors:

- no message ports;
- no timers or independent JS runtime;
- no standalone execution of the module;
- Run and `Shift+Enter` commit the current draft and rerun its dependents.

Deleting a mirror removes only the canvas view and keeps the Patch file importable. Deleting the Patch file removes its mirror in the same global history operation. Undo restores the affected file or mirror with its complete prior state, including canvas position and dimensions.

A manually edited or corrupt patch may contain a mirror whose VFS path is missing. Patchies keeps a non-executing broken mirror with a generic **Patch file not found** state. Restoring the exact file reconnects the mirror.

## Resolution Rules

JSRunner uses one canonical resolver for Rollup `resolveId`, dependency readiness, worker module synchronization, and dependent lookup. These surfaces must not implement separate precedence rules.

### Package and URL Imports

- `npm:<package>` keeps the existing npm resolution behavior.
- `http://` and `https://` keep the existing URL behavior.

Patch files never shadow packages because package imports require `npm:`. A missing Patch-root import does not fall through to NPM.

### Patch-Root Imports

Any module specifier that is not relative and does not contain a recognized VFS namespace, NPM prefix, or URL protocol resolves from the `patch://` root:

| Specifier          | Canonical module           |
| ------------------ | -------------------------- |
| `foo`              | `patch://foo.js`            |
| `foo.js`           | `patch://foo.js`            |
| `foo/bar/baz`      | `patch://foo/bar/baz.js`    |
| `foo/bar/baz.js`   | `patch://foo/bar/baz.js`    |
| `foo/bar/baz.mjs`  | `patch://foo/bar/baz.mjs`   |

Resolution is case-sensitive. A written `.js` or `.mjs` extension is preserved; otherwise the resolver appends `.js`. It does not check extensionless files, infer `.mjs`, search recursively, read package manifests, or resolve directory `index.js` files. Directory-index inference may be added later as a separate feature.

Patch-root shorthand uses canonical POSIX paths. It rejects leading slashes, backslashes, empty path segments, `.` segments, `..` segments, and namespace-root escapes. Each Patch module therefore has one shorthand identity.

### Relative Imports

Relative imports use standard filesystem semantics:

- Canvas-node code has no file path, so `./utility` resolves from the `patch://` root.
- `patch://lib/camera.js` importing `./utility` resolves to `patch://lib/utility.js`.
- `user://lib/camera.js` importing `./utility` resolves to `user://lib/utility.js`.
- `../` is supported but cannot escape the current namespace root.

A written `.js` or `.mjs` extension is preserved; otherwise the resolver appends `.js`.

### Explicit VFS Imports

`patch://` and `user://` imports resolve explicit VFS paths. A written `.js` or `.mjs` extension is preserved; otherwise the resolver appends `.js`.

Explicit `user://` modules remain importable but read-only in the first Files editor release. Patchies rereads a linked module whenever an importing node explicitly executes. Automatic reruns for changes made by an external filesystem editor are not part of this phase.

### User-Code VFS API

These import rules do not change the general user-code VFS API. `vfs.getUrl("./foo")`, `vfs.list(".")`, and other relative VFS helper paths continue to default to `user://`.

## Supported Patch Modules

Patchies recognizes `.js` and `.mjs` Patch files as JavaScript modules. Only `.js` is inferred. Embedded-file encoding and size limits come from spec 52:

- UTF-8 text only;
- 256 KiB maximum per file;
- 1 MiB maximum total `patch://` content.

## Registration and Hydration

Patchies hydrates and registers all Patch JavaScript files before node runtimes start. This prevents nodes from executing once with missing modules during patch load.

Canonical VFS paths are the keys in JSRunner's module registry. Registration populates:

- the main-thread JSRunner;
- the dedicated JS worker module snapshot;
- the render-worker JSRunner through the existing module update bridge.

The synchronization API is explicit and replayable. A worker initialized after Patch hydration still receives every registered Patch module before it executes importing code. Canvas mirrors do not add runtime registrations or module identities.

## Shared Editing and Dependent Reruns

Files and the canvas share one editor session and draft per canonical Patch path. Opening the same module in both places does not create competing drafts. The views share dirty state, CodeMirror undo history, conflict state, and committed revisions.

The Files Save button, canvas Run button, `Cmd/Ctrl+S`, `Shift+Enter`, Vim `:w`, and immediate value-widget saves use the same commit path. Dirty navigation and rename use the shared Save / Discard / Cancel guard. A committed change:

1. writes the embedded text and content revision to VFS;
2. replaces the canonical module source in every JSRunner environment;
3. finds importers through canonical dependency identities;
4. reruns direct and transitive dependents exactly once in dependency order.

Run still bundles and validates a module with no current dependents, but it does not execute the module in an independent canvas runtime. Invalid JavaScript remains saveable. Importers report the new error and retain their last-known-good runtime or visual output where supported.

CodeMirror undo and redo apply to the shared draft. Each commit is one global history operation. A committed VFS change made elsewhere updates a clean editor without remounting it; a dirty editor uses the shared conflict guard instead of overwriting either version.

## Rename and Delete

Renaming a Patch JavaScript file or a folder rewrites every affected string-literal module specifier across Patch JavaScript sources. Rewriting covers:

- static imports;
- re-exports;
- string-literal dynamic `import()` calls;
- relative Patch paths;
- Patch-root shorthand paths;
- explicit `patch://` paths.

The rewrite preserves relative versus root shorthand versus explicit VFS style and preserves the written extension style where possible. It does not rewrite computed imports or ordinary strings.

The VFS move, rewritten sources, and updated mirror paths form one global history operation. Patchies stages the complete change before writing anything. A collision, invalid destination, or source that cannot be rewritten safely rejects the entire operation without partial mutation.

Deleting a file or folder with known importers shows one dependency-aware confirmation. An accepted deletion removes the complete VFS subtree and every affected mirror in one global history operation. Deleting an unused module needs no additional warning.

Undo and redo restore or reapply paths, contents, revisions, mirror state, module synchronization, and dependent reruns together.

## Failure Behavior

Resolution failures return a structured generic module-not-found error instead of polling or substituting an empty generated program. The error includes:

- the original specifier;
- the importing node or VFS path;
- canonical paths attempted;
- the attempted resolution category.

There is no `@lib`-specific warning, compatibility diagnostic, or fallback. Errors appear in the existing virtual console/runtime error surface.

When a committed module fails to resolve, bundle, or execute in an importer, dependent nodes report the error and retain their previous working runtime or visual output where supported. Invalid source remains saveable because users may intentionally persist work in progress.

## Compatibility

This is an intentional alpha-stage breaking change. Patchies does not migrate existing `@lib` nodes and does not retain their parser, registry, node-data mode, or resolution precedence. Their declarations become inert comments, their nodes behave as ordinary executable `js` objects, and their former bare imports resolve only if the corresponding Patch file exists.

Bundled demos, documentation, AI prompts, and presets using `@lib` must be rewritten to create and import Patch files as part of implementation. Existing `user://`, npm, URL, relative Patch, and explicit VFS behavior remains supported.

The earlier saved-patch migration that adds an empty `files.patch` tree remains unchanged. No additional migration is introduced for this follow-up.

## Verification

Test observable resolution and lifecycle behavior through public APIs and runtime outcomes:

1. Root and nested Patch shorthand resolve with and without a written `.js` extension.
2. `.mjs` resolves only when its extension is explicit.
3. Shorthand paths are canonical and cannot escape or alias the Patch namespace.
4. Relative imports use the importer directory and cannot escape the namespace root.
5. Explicit Patch, explicit User, npm, and URL imports retain their documented behavior.
6. Missing Patch modules fail promptly with a generic structured diagnostic and never fall through to NPM.
7. Hydration registers Patch modules before importer execution in main-thread, dedicated-worker, and render-worker environments.
8. Files and canvas mirrors share one draft, dirty state, conflict guard, and CodeMirror history.
9. Save, Run, keyboard commands, Vim `:w`, and immediate widget commits synchronize one revision and rerun direct and transitive dependents exactly once.
10. Run bundles and validates a module with no dependents without creating an independent runtime.
11. A file drop creates at most one editor-only mirror and a repeated drop focuses it.
12. Deleting a mirror keeps its file; deleting a file or subtree removes affected mirrors; global undo and redo restore exact state.
13. Rename rewrites all supported specifier forms while preserving style, and a staging failure changes nothing.
14. A missing mirrored path renders a recoverable generic error state and reconnects when the file returns.
15. `@lib` has no runtime, UI, or resolution behavior.
