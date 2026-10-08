# 194. Generated Object Code Roadmap

**Status:** Agreed import design; proposed release sequence; implementation pending.

## Problem

AI-generated objects often contain large programs in a single source field. Users have to navigate and review the whole program even when changing one behavior. Adding supporting files alone does not solve the AI workflow: automatically sending and returning the complete object would still consume context and encourage full rewrites.

The priority is Quick Insert/Edit: generate understandable multi-file objects, make their source easy to edit by hand, and let Quick Edit make focused changes across one or several files. Object-specific dependencies should travel with the object; intentionally shared dependencies belong in the Patch filesystem. Chat can adopt the same tools later.

## Roadmap Scope

This roadmap records the agreed import rules and independently useful releases. It spans object storage and runtime imports, editor navigation, AI tools and review, and preset portability. Detailed implementation specs can be added for individual releases as they are taken on.

## Object-Owned Dependencies

Object-owned supporting files will be exposed under `obj://<object-id>/`. Entry source keeps its existing authoritative object-data field and receives a canonical Objects path for import resolution. The rules below supersede the Patch-root shorthand and inline-object relative-import rules in [spec 121](121-vfs-js-modules.md) when this work ships.

### Import Resolution

- Relative imports in object entry source resolve within that object's directory. For example, `obj://p5-20/code.js` importing `./utils/world.js` resolves to `obj://p5-20/utils/world.js`.
- Relative imports in supporting files resolve from the importing file's directory. Parent traversal may move within the owning object but cannot escape to another object or namespace.
- Shared Patch dependencies require explicit `patch://` imports from object-owned source. Remove bare Patch-root shorthand: `utils/world` does not implicitly resolve to `patch://utils/world.js` or an npm package.
- A missing private helper fails without falling back to a same-named Patch file.
- Relative imports within Patch and User modules continue to resolve from the importing file's directory in that namespace. Explicit `npm:`, URL, User, and Patch imports retain their existing behavior and JavaScript extension inference rules.
- Private helpers belong to their owning object; they do not become shared modules. Duplicating an object changes their canonical identities without rewriting private relative imports.
- These changes apply to module imports. General user-code VFS helper paths retain their existing `user://` relative-path default.

```js
// Entry source: obj://p5-20/code.js
import { createWorld } from './utils/world.js';
import { clamp } from 'patch://shared/math.js';
import * as THREE from 'npm:three';
```

### Breaking Change

Poom confirmed that object-local relative imports and explicit `patch://` shared dependencies can be a breaking change. Do not add compatibility fallbacks or automatic import migrations. Update affected built-in presets, demos, documentation, and AI instructions as part of implementation.

Object-local imports require resolver, module registration, dependency tracking, and worker synchronization changes. VFS visibility alone does not establish runtime import support. Strudel uses a separate evaluator and requires a dedicated integration before advertising support there.

### Runtime Verification

1. Entry and nested-helper relative imports resolve to the owning object's files.
2. Parent traversal cannot escape the owning object, and one object cannot import another object's private helpers.
3. Duplicated objects resolve independent private helpers without rewriting relative imports.
4. Missing private imports fail even when a same-named Patch module exists.
5. Explicit `patch://` shared imports work; bare Patch-root imports fail.
6. Relative imports within Patch/User modules and explicit `npm:`/URL/User imports retain their behavior.
7. Supporting modules are available before execution in every supported runtime environment, and changes refresh the appropriate direct and transitive consumers.

## Proposed Release Sequence

Poom uses Quick Edit more often than Chat and prioritizes multi-file Quick Insert/Edit plus object-owned JavaScript files. Deliver the private-object workflow first. Chat is a later consumer of the same tools, not the first implementation or a prerequisite.

Each release must provide a working user flow, including its focused verification. Keep supporting types and helpers with their first consumer; do not ship unused storage, resolver, or transaction scaffolding as a release. This sequence is a proposal for discussion, not implementation approval.

| Release | User outcome | Complete scope | Verification |
| --- | --- | --- | --- |
| 1. Private JavaScript files, editable by hand | Users can split an object into understandable private modules that travel with copies and presets. | Supporting-file storage, nested Objects projection, file creation/editing/removal through Files, canonical object-local imports, removal of bare Patch-root imports, ownership checks, hydration and synchronization across supported JSRunner environments, dependency refresh, serialization/copy/preset preservation, and undo. Provide a minimal object-editor file selector so entry source and private helpers are easy to reach; reuse the established editing lifecycle. Tabs and advanced file management are deferred. | Manual add/edit/import/run works end to end; editor and Files stay synchronized; copies own independent files; save/load/preset round trips preserve them; main-thread and worker imports, history, and consumer refresh work. |
| 2. Quick Edit makes focused multi-file changes | Cmd/Ctrl+I can change one or several existing files without regenerating the entire object. | Introduce bounded object context, file discovery/content search, on-demand reads, and revision-checked targeted edits with Quick Edit as the first consumer. Stage changes to the selected object's entry source, existing private files, and relevant configuration. Review all diffs and apply the complete object update as one undoable operation. Reads see staged source. Detect concurrent source edits; Cancel/failure preserves live state. Patch/User dependencies are readable subject to existing permissions but are not mutable through this release's AI tools. | Single-file and coordinated helper/entry edits, bounded context, staged reads, ambiguous replacements, stale sources, editing conflicts, Apply/Cancel, one undo, and one owning-object refresh. |
| 3. Quick Insert generates multi-file objects | A new generated object arrives as a small, readable program with private helpers that users can hand-edit. | Extend the Quick workflow's workspace with private-file creation and staged writes. Route to a supported object type, then generate entry source, settings, and cohesive private files in a temporary object workspace. Review generated files before inserting one complete object. The model does not need to reproduce the complete file map in a final response. Reuse creation tools in Quick Edit so an existing monolith can be refactored into new private helpers. Tiny objects remain single-file. Private-file deletion/rename tools can follow when required by a concrete editing flow. | Generated imports execute after insertion; no partial object appears during generation; cancellation and late responses cannot insert source; entry/helper creation in Quick Edit applies together; copy/preset portability and one-operation undo work. |
| 4. Quick Insert/Edit writes shared Patch modules | Users can explicitly ask the Quick workflow to create or modify shared dependencies. | Extend the same tools to staged Patch creation and targeted editing, with actual resource capabilities, complete object-plus-VFS review, dirty-Patch-draft protection, destination collision and revision checks, known affected consumers, atomic validation/apply, one global undo, and one refresh per affected consumer. Object-private files remain the default for object-specific generated code. External User resources remain read-only. | New/shared module plus importer works after Apply; shared changes refresh affected consumers; collisions/conflicts and cancellation preserve all state; undo/redo restores the complete refactor. |
| 5. Presets capture Patch dependencies | A preset using shared modules works when inserted into another patch. | Per-preset dependency snapshots, transitive discovery and unresolved-reference review, explicit extra dependencies, identical-content reuse, differing-content collision choices and safe reference remapping, atomic dependency installation plus insertion, export/import, and undo. Private supporting files already travel inside preset data from release 1. Library-wide shared versions are deferred. | Transitive/cyclic/missing/computed dependencies, collisions, snapshot independence, cross-patch insertion, and complete insertion undo. |
| 6. Chat reuses the file workflow | Sidebar chat gains the same file discovery, editing, and review capabilities once the Quick workflow is useful. | Connect the established tools/workspace to Chat and replace automatic full selected-object serialization with bounded metadata and source discovery. Keep ownership, staged reads, revision checks, resource permissions, review/apply, and history semantics shared. Do not require a separate Chat mutation implementation. | Chat tool-loop discovery, targeted edits and structural changes, bounded context, permissions, Apply/Cancel, and the same history/conflict outcomes as the Quick workflow. |

Recommended first milestone is releases 1–3: private modules can be edited manually, Quick Edit can change several files, and Quick Insert can generate a readable multi-file object. No Chat work, shared Patch writes, or Patch-dependency preset packaging is required to reach that milestone. Release 2 is independently useful before generation support: users can ask Quick Edit to change entry source and manually created helpers together.

The dependency graph permits later branches:

- Release 4 extends the Quick workspace from one object's data to object-plus-Patch transactions. This wider transaction scope is not a prerequisite for editing or generating several private files inside one object.
- Release 5 can reuse release 4's object-plus-VFS transaction support. Saving an object-owned-file preset already works from release 1; release 5 handles shared Patch dependencies only.
- Chat may reuse whichever Quick capabilities have shipped, but it is lower priority than the private-file Quick workflow and must not delay releases 1–3.
- GLSL private includes and Strudel private modules are separate runtime releases after the object-file lifecycle is established. Each must demonstrate a usable import/edit/run flow in its own evaluator. Sequence them according to the object types Poom uses most; do not assume JSRunner support enables Strudel.
- Make self-contained follows private files plus dependency discovery/reference remapping. It previews and copies a dependency closure into the object as one undoable conversion, leaving original shared files intact.

## Related Specs

- [52. Virtual Filesystem](52-virtual-filesystem.md): namespace ownership, live Objects projection, file editing, and persistence.
- [121. VFS JavaScript Modules](121-vfs-js-modules.md): existing module resolution, synchronization, dependency refresh, and history.
- [180. Chat VFS Context Tools](180-chat-vfs-context-tools.md): existing read-only file inspection tools.
- [54. User Preset Libraries](54-user-preset-libraries.md): preset storage and portability.
