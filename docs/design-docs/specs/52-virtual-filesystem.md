# 52. Virtual Filesystem

> Status: Implemented through Stage 2; Patch JavaScript modules planned for Stage 3

I wanted the ability to persist, browse and resolve files in a virtual file system.

## Goals

- I want to be able to have a virtual filesystem with directories and files
- I want to be able to resolve the content of folders anG files from many providers
  - example: some files might be resolved from a static url, while other files and folders may need to be loaded from user's filesystem
- I want to be able to visually browse that filesystem
  - e.g. with "Command Palette > Toggle Sidebar"
  - should show up in a collapsible sidebar on the left side
  - See files and directories in a tree structure
  - Be able to view files. See images and hear audio files.
  - Create and delete files and directories
  - Set a "provider" on where to load a specific file or directory
    - e.g. you might load video.mp4 from a URL, but you might load super-secret.jpeg from your own local filesystem
- The UI should be able to show "unmapped files"
- API-wise, it should be easy to write your own provider.
  - Ideally we have a class for providers e.g. `LocalFilesystemProvider`, `UrlProvider`

## Providers

- Local Filesystem: use the `Filesystem` browser API to map the virtual filesystem file and folder to the user's local folder
  - default when the file dragged into the canvas or obj
- URL: load that file content from a given URL
  - creating an object with a default url e.g. `img <url>` should use the URL provider automatically
  - using a message to set the url should use the URL provider automatically
- (Future) cloud providers: dragging a file into Patchies can upload it to a default cloud provider automatically e.g. S3, Minio

## Example

```txt
/user
  /images
    /poom.jpg  -- {provider: 'url', url: 'https://poom.dev/cool'}
  /secrets     -- {provider: 'local'}
```

## Design Ideas

- Each object must only store the virtual filesystem path, it must not store the file object.
- Create a singleton class `VirtualFilesystem` for accessing the virtual filesystem.
- Patchies vfs has two prefixes:
  - `user://` is for user uploaded files. example: `user://images/poom.jpg`
  - `obj://` is for files associated with obj, using `/<object-id>` as prefixes.
    - example: `obj://chuck~-24` contains filesystem for a ChucK object
    - example: `obj://elem~-36` contains filesystem for an Elementary Audio object
    - example: `obj://csound~-42` contains filesystem for a Csound object
    - only some node will have a virtual node filesystem, such as `chuck~` and `elem~` and `csound~`
  - the prefixes helps us to check if it is a virtual filesystem path, or an already resolved path.
- Saved patches store a `files` mapping for persistent namespaces such as `user://`. The `obj://` tree is runtime-only and is rebuilt from the objects in the patch; serializing it would create a second source of truth.

```ts
{
    "nodes": [],
    "edges": [],
    "files": {
        "user": {
            "images": {
                "poom.mp4": {
                    provider: "url",
                    url: "https://"
                },
                "foobar.mp4": {
                    provider: "local",
                },
            }
        }
    }
}
```

## Integration Paths

- persist uploaded media in media source objects
  - images (`img`)
  - video (`video`)
  - sound (`soundfile~`)
  - converted recorded samples in `sampler~`

- Deeper integration will be in [53. Virtual Filesystem Object Integrations](./53-virtual-filesystem-object-integrations.md)

---

## Implementation Plan (Phase 1: `img` node only)

### Scope

Focus on the `img` node as the first integration point. This validates the VFS architecture before expanding to `video`, `soundfile~`, and other nodes.

### File Structure

```text
src/lib/vfs/
├── VirtualFilesystem.ts        # Singleton, main API
├── types.ts                    # VFSEntry, VFSProvider, VFSTree types
├── path-utils.ts               # Path parsing, collision handling
├── persistence.ts              # IndexedDB for FileSystemHandles
└── providers/
    ├── UrlProvider.ts          # Resolve from URL
    └── LocalFilesystemProvider.ts  # File System Access API
```

### Core Types

```ts
// types.ts
export type VFSProviderType = "url" | "local";

export interface VFSEntry {
  provider: VFSProviderType;
  url?: string; // for 'url' provider
  filename: string; // original filename for display
  mimeType?: string; // e.g., 'image/png'
}

export interface VFSProvider {
  type: VFSProviderType;
  resolve(entry: VFSEntry): Promise<File | Blob>;
  canPersist(): boolean;
}

// Tree structure for serialization (matches patch format)
export interface VFSTree {
  user?: Record<string, VFSEntry | VFSTree>;
}
```

### VirtualFilesystem Singleton API

```ts
class VirtualFilesystem {
  static getInstance(): VirtualFilesystem;

  // Registration
  registerFile(path: string, entry: VFSEntry): void;
  registerLocalFile(file: File): Promise<string>; // returns generated path like 'user://images/photo.jpg'
  registerUrl(url: string): Promise<string>; // returns generated path

  // Resolution
  resolve(path: string): Promise<File | Blob>;
  getEntry(path: string): VFSEntry | undefined;

  // Path utilities
  isVFSPath(path: string): boolean; // checks for user:// or obj:// prefix

  // Listing
  list(prefix?: string): string[]; // list all paths under prefix

  // Persistence
  serialize(): VFSTree; // for patch save
  hydrate(tree: VFSTree): Promise<void>; // for patch load

  // Permission management (for local files after reload)
  getPendingPermissions(): string[]; // paths needing user permission
  requestPermission(path: string): Promise<boolean>;
  requestAllPermissions(): Promise<Map<string, boolean>>;

  // Cleanup
  remove(path: string): void;
  clear(): void;
}
```

### IndexedDB Schema (for FileSystemHandle persistence)

```ts
// persistence.ts
// DB: 'patchies-vfs'
// Store: 'handles'
// Key: VFS path (e.g., 'user://images/photo.jpg')
// Value: FileSystemFileHandle

async function storeHandle(
  path: string,
  handle: FileSystemFileHandle,
): Promise<void>;
async function getHandle(
  path: string,
): Promise<FileSystemFileHandle | undefined>;
async function removeHandle(path: string): Promise<void>;
async function getAllHandles(): Promise<Map<string, FileSystemFileHandle>>;
async function clearHandles(): Promise<void>;
```

### Path Generation (collision handling)

```ts
// path-utils.ts
function generateUserPath(
  filename: string,
  existingPaths: Set<string>,
): string {
  // Input: 'photo.jpg'
  // Output: 'user://images/photo.jpg' or 'user://images/photo-1.jpg' if collision

  const ext = getExtension(filename); // '.jpg'
  const base = getBasename(filename); // 'photo'
  const category = getCategoryFromMime(); // 'images' | 'videos' | 'audio' | 'files'

  let path = `user://${category}/${filename}`;
  let counter = 1;
  while (existingPaths.has(path)) {
    path = `user://${category}/${base}-${counter}${ext}`;
    counter++;
  }
  return path;
}
```

### ImageNode Changes

```svelte
<!-- Before -->
data: {
  fileName?: string;
  file?: File;        // ephemeral, lost on reload
  width?: number;
  height?: number;
}

<!-- After -->
data: {
  vfsPath?: string;   // e.g., 'user://images/photo.jpg'
  width?: number;
  height?: number;
}
```

**Load flow:**

1. `onMount` → check `node.data.vfsPath`
2. If exists → `vfs.resolve(vfsPath)` → load into GLSystem
3. If resolution fails (permission needed) → show placeholder with "grant permission" button

**Drop/select flow:**

1. User drops file → `vfs.registerLocalFile(file)` → returns path
2. Store path in `node.data.vfsPath`
3. Load image into GLSystem

**URL message flow:**

1. Receive URL message → `vfs.registerUrl(url)` → returns path
2. Store path in `node.data.vfsPath`
3. Load image into GLSystem

### Save/Load Integration

**PatchSaveFormat update:**

```ts
export type PatchSaveFormat = {
  name: string;
  version: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  files?: VFSTree; // NEW
};
```

**Serialize:**

```ts
function serializePatch(): PatchSaveFormat {
  const vfs = VirtualFilesystem.getInstance();
  return {
    // ...existing fields
    files: vfs.serialize(),
  };
}
```

**Restore:**

```ts
async function restorePatchFromSave(patch: PatchSaveFormat) {
  const vfs = VirtualFilesystem.getInstance();
  vfs.clear();

  if (patch.files) {
    await vfs.hydrate(patch.files);
  }

  // Check for pending permissions
  const pending = vfs.getPendingPermissions();
  if (pending.length > 0) {
    // Show permission prompt UI
    showPermissionPrompt(pending);
  }

  // ...rest of restore logic
}
```

### Permission Prompt UI

When loading a patch with local files, show a modal/toast:

```text
┌─────────────────────────────────────────┐
│  Some files need permission to access   │
│                                         │
│  📁 photo.jpg                           │
│  📁 background.png                      │
│                                         │
│  [Grant All Permissions]  [Skip]        │
└─────────────────────────────────────────┘
```

Alternatively, in a future file browser sidebar, highlight files needing permission with a 🔒 icon.

### Migration

```ts
// migrations/002-add-files-field.ts
export const migration002: Migration = {
  version: 2,
  name: "add-files-field",
  migrate(patch: RawPatchData): RawPatchData {
    return {
      ...patch,
      files: patch.files ?? { user: {} },
    };
  },
};
```

### Implementation Order

1. **Core infrastructure** — types, path-utils, VirtualFilesystem class (in-memory only)
2. **Providers** — UrlProvider, LocalFilesystemProvider
3. **IndexedDB persistence** — store/retrieve FileSystemHandles
4. **ImageNode integration** — update to use VFS paths
5. **Save/load integration** — serialize/hydrate VFS tree
6. **Permission UI** — prompt for local file permissions on load
7. **Migration** — add migration 002

### Testing Checklist

- [x] Drop image file → stored in VFS → displays correctly
- [x] Send URL message → stored in VFS → displays correctly
- [x] Save patch → VFS tree included in JSON
- [x] Load patch with URL files → resolves automatically
- [x] Load patch with local files → prompts for permission → resolves after grant
- [x] Collision handling → `photo.jpg`, `photo-1.jpg`, `photo-2.jpg`
- [x] Delete node → VFS entry remains (intentional, for undo support)
- [x] Clear patch → VFS cleared

## User-Code API

JavaScript-capable objects expose a single asynchronous `vfs` helper. It replaces the former `getVfsUrl` global.

```javascript
await vfs.get("./data.json").json(); // read and parse file contents
await vfs.get("./notes.txt").text(); // read file contents as text
await vfs.getUrl("./foo.png"); // resolves user://foo.png to an object URL
await vfs.getUrl("user://foo.png"); // explicit VFS path
await vfs.list("."); // direct entries of user:// as { path, name, kind }
await vfs.search("foo", "./assets"); // recursively search entries under user://assets
```

`vfs.get(path)` returns a lazy reader with `json()`, `text()`, `blob()`, and `arrayBuffer()` methods. Each method resolves and fetches the file, then returns the requested representation. Relative paths default to `user://`; absolute external URLs passed to `get` or `getUrl` remain external. `list` is non-recursive and returns entries with full VFS paths, names, and file or directory kinds. `search` is case-insensitive, recursive, and returns matching entries in the same shape. Both methods traverse linked local folders after permission has been granted.

## Patch-Local Text Files and Editing

Patchies needs an explicit ownership boundary between files embedded in a patch and files resolved from outside it. Provider metadata alone is not enough: a `user://` entry may refer to a filesystem handle, URL, or browser-local IndexedDB fallback, while small source files should travel with the saved patch.

### Namespaces and Ownership

The VFS has three namespaces:

| Namespace | Ownership | Persistence | Editing in the Files panel |
| --- | --- | --- | --- |
| `patch://` | Embedded in the current patch | Serialized under `files.patch` | Supported text files are editable |
| `user://` | External or browser-local user resource | Handle, URL, or patch-scoped IndexedDB fallback | Read-only in the first editor release |
| `obj://` | Object-owned resource | Runtime-only; rebuilt from object state | Not editable independently |

An embedded entry uses the `embedded` provider and stores UTF-8 text directly:

```ts
interface EmbeddedVFSEntry extends VFSEntry {
  provider: "embedded";
  content: string;
}
```

`embedded` entries are valid only under `patch://`, and every entry under `patch://` must be embedded. Patch JSON stores the namespace alongside the existing trees:

```ts
interface VFSTree {
  patch?: Record<string, VFSTreeNode>;
  user?: Record<string, VFSTreeNode>;
}
```

`obj://` is deliberately excluded from `VFSTree`. Object-owned entries are a virtual runtime view of each object's own state. Serialization and hydration ignore that namespace so patch files never contain a competing copy.

The serialized text is a normal JSON string, not base64. Limits use UTF-8 byte length:

- 256 KiB maximum per embedded file
- 1 MiB maximum total embedded content per patch
- UTF-8 text only

The initial editable formats are:

- JavaScript: `.js`, `.mjs`
- GLSL: `.gl`, `.glsl`, `.frag`, `.vert`, `.glslf`, `.glslv`

Only `.js` and `.glsl` are inferred when an import omits its extension. Other supported extensions must be explicit.

### Files Panel

The Files tree shows namespace roots in this order:

1. Patch (always visible)
2. User (always visible)
3. Objects (visible only when populated)

The drop target declares ownership:

- Drop into Patch: copy allowed text into `patch://` and serialize it with the patch.
- Drop into User: retain the linked-file behavior under `user://`.
- Drop User to Patch: copy and embed; retain the linked original.
- Patch to User is not an internal move. Use **Save to Disk…** to export a copy without changing ownership.

Patch folder drops are atomic. Patchies embeds the complete folder only when every file is allowed and the result fits within the patch budget. Otherwise it embeds nothing and reports the offending files. Name collisions show Replace, Keep Both, and Cancel; replacement is undoable, and Keep Both uses numbered suffixes.

New File is available in Patch and its folders. It creates empty content, requires an explicit supported extension, and rejects case-sensitive duplicate paths.

### Editor Behavior

Double-clicking an editable Patch file, or choosing **Edit** from its context menu, transforms the Files panel into a CodeMirror editor. Search results provide the same actions. On mobile, Edit appears in the selection toolbar. A single click continues to select a row.

The editor header contains:

- Back
- the full `patch://` path
- a dirty indicator
- Save with a `Cmd/Ctrl+S` shortcut
- Rename, Copy Path, Save to Disk, and Delete in an overflow menu

CodeMirror keeps a local draft. Save is explicit; unsaved drafts do not change consumers. Back, sidebar navigation, opening another file, loading another patch, and rename while dirty use one Save / Discard / Cancel guard. Browser reload and window close use the standard unsaved-changes warning.

Invalid JavaScript or GLSL remains saveable because include files may not compile independently and users may save work in progress. Save validates only path, UTF-8 encoding, and size. Consumers retain their last working output when the saved source fails.

CodeMirror undo and redo apply to the draft. Each successful Save is one global history operation. Create, delete, rename, replacement, and User-to-Patch copy also participate in global undo. Restoring clean open content updates the editor without remounting it; a dirty editor shows a conflict guard. Undoing creation of the open file returns to the tree, while undoing a rename updates the open path.

### File Modification Contract

Saving or restoring embedded content emits a path-specific modification with a monotonic content revision. File size alone is not a valid revision because same-length edits must invalidate consumers.

The modification contract:

- synchronizes saved JavaScript modules to every JSRunner environment;
- reruns direct and transitive JavaScript dependents;
- clears affected GLSL VFS caches;
- recompiles direct and transitive shader consumers;
- preserves the previous working output on failure and reports the new error.

Hydration registers all `patch://` files before node runtimes start. A manually edited patch that exceeds the embedded budget still loads its graph for recovery, but Patchies refuses to open or execute offending files and offers their paths and sizes so users can delete or export them.

### Compatibility

Existing `user://` entries are not converted to `patch://`. A patch migration adds an empty `files.patch` tree when missing.

IndexedDB remains a fallback for browsers without filesystem handles and a persistence store for handles, but new keys are scoped by patch ID plus VFS path. When a scoped record is missing, Patchies may read a matching legacy path-only record once and copy it to the scoped key. It does not delete the legacy record because another old patch may still reference it.

The existing user-code VFS API keeps its current defaults: `vfs.getUrl("./foo")`, `vfs.list(".")`, and similar relative paths resolve under `user://`. The `patch://` shorthand applies only to JavaScript imports and GLSL includes.

### Internal Architecture

`VirtualFilesystem` is the stable public facade. Its implementation composes internal modules so provider, persistence, history, browsing, and Patch-file rules do not accumulate in the facade:

- `VfsEntryIndex` owns the in-memory entry map and all path-tree calculations, including rename and deletion plans.
- `VfsDirectoryReader` owns directory listing, pagination, recursive search, and traversal of linked local folders.
- `VfsTreeCodec` converts between the flat entry index and the serialized patch tree without accessing providers or UI state.
- `VfsPermissionTracker` owns paths that need file or directory permission and scans hydrated entries against the local provider.
- `PatchFileOperations` owns the complete `patch://` lifecycle. It delegates atomic import staging to `PatchImportPlanner` and applies the same embedded-content policy to create, write, read, export, import, and recovery hydration.
- `VfsMutationCoordinator` records complete VFS state transitions as one global history operation and serializes asynchronous provider effects from undo and redo.

The Files panel continues to own user interaction such as asking whether to Replace, Keep Both, or Cancel. Browser `DataTransfer` traversal stays in a separate adapter. These modules report plans and outcomes; they do not depend on Svelte UI state.

## Delivery Plan

Ship the feature in exactly three pull requests. Each pull request is a complete release point with its own user outcome and focused verification. Tests stay in the same commit as the behavior they verify; do not create preparatory commits containing only types or unused helpers.

### Stage 1: Portable Patch Files

Users can store small files inside a patch, save and share them, and manage them from the Files tree. Patch files are not editable in this stage.

Scope:

- add the `patch://` namespace and `embedded` provider;
- serialize and hydrate contents under `files.patch`;
- migrate older patches with an empty Patch namespace;
- enforce UTF-8, per-file, and per-patch size limits;
- show Patch, User, and Objects roots in the Files tree;
- make OS drops namespace-sensitive;
- support User-to-Patch copy, Save to Disk, collision handling, and atomic folder imports;
- make VFS create, write, replace, rename, delete, and copy operations globally undoable;
- scope new IndexedDB keys by patch ID and VFS path, with non-destructive legacy fallback.

Verification:

1. Embedded contents survive serialize and hydrate round trips.
2. Older patches load with an empty Patch namespace without converting `user://` entries.
3. Invalid provider and namespace combinations and size violations are rejected.
4. Two patches using the same `user://` path do not share browser-local bytes or handles.
5. Files-tree tests cover namespace order, each drop target, rejected and atomic drops, collisions, export, and history.
6. Undo and redo restore VFS state and content revisions for every mutation.

Release criterion: Patch files are portable and manageable through the Files tree without requiring the editor or a runtime import consumer.

### Stage 2: Patch GLSL Editing and Imports

Status: Implemented.

Users can create, edit, and import GLSL utilities from `patch://`. JavaScript Patch files remain visible and portable but read-only until Stage 3.

Scope:

- transform the Files panel into a CodeMirror editor for supported GLSL files;
- support New File for GLSL files in Patch folders;
- implement drafts, dirty state, equivalent button / shortcut / Vim `:w` saves, and the shared navigation guard;
- provide the same GLSL assistance as the `glsl` object;
- save inline value-widget edits and refresh shader consumers immediately;
- add Edit actions to normal rows, search results, and the mobile toolbar;
- resolve relative, explicit Patch, and explicit User GLSL includes;
- infer only the `.glsl` extension;
- invalidate affected caches and direct and transitive shader consumers after saved revisions;
- report missing includes in the consumer's virtual console and highlight the originating `#include` line;
- retain the last working visual output when saved source fails.

Verification:

1. Editor tests cover entry points, draft isolation, `Cmd/Ctrl+S`, `Shift+Enter`, Vim `:w`, Save / Discard / Cancel, and global history while open.
2. Resolver tests cover relative, explicit, inferred-extension, circular, and namespace-escape cases.
3. Saved changes refresh direct and transitive consumers exactly once.
4. Unsaved drafts do not invalidate consumers.
5. Invalid saved source reports an error and preserves the previous visual output.
6. A missing VFS include appears in the consumer's virtual console and highlights the originating `#include` line.
7. Inline value-widget edits save the Patch file and refresh its shader consumers.

Release criterion: GLSL Patch-file authoring works end to end without depending on JavaScript module support.

### Stage 3: Patch JavaScript Editing and Modules

Users can edit Patch JavaScript modules and import them in every JSRunner-backed environment.

Scope:

- enable `.js` and `.mjs` in the Patch editor with module-specific CodeMirror behavior;
- centralize JS module resolution for Rollup, dependency readiness, workers, and dependent lookup;
- preserve `// @lib` precedence and add top-level Patch fallback;
- support standard relative and explicit VFS imports;
- report structured missing-import errors promptly;
- hydrate and register Patch modules before runtime execution;
- synchronize modules to main-thread, dedicated-worker, and render-worker JSRunner environments;
- generalize dependency tracking from source node IDs to canonical module sources;
- rerun direct and transitive importers after Save and global undo;
- retain last-working runtime or visual output on failure where the owning runtime supports it.

Verification:

1. Resolver tests cover `// @lib`, bare Patch fallback, relative, explicit Patch, explicit User, npm, and URL precedence.
2. The same Patch module imports successfully in every JSRunner environment.
3. Hydration completes before importer execution.
4. Missing imports fail promptly with structured diagnostics rather than a dependency timeout or empty program.
5. Alias, relative, explicit, and transitive dependencies rerun in dependency order exactly once.
6. Existing `// @lib`, npm, URL, and `user://` behavior remains compatible.

Release criterion: JavaScript Patch modules work end to end with automatic synchronization and dependent reruns.
