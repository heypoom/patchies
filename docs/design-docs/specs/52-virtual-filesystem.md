# 52. Virtual Filesystem

> Status: Implemented

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
- In the saved patches, we should also store a `files` mapping as well, with top-level namespaces `user` (`user://`) and `objects` (`obj://`):

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
        },
        "objects": {
           "csound~-24": {},
           "elem~-36": {},
           "chuck~-48": {}
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
  objects?: Record<string, VFSTree>;
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
      files: patch.files ?? { user: {}, objects: {} },
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
await vfs.getUrl("./foo.png"); // resolves user://foo.png to an object URL
await vfs.getUrl("user://foo.png"); // explicit VFS path
await vfs.list("."); // direct entries of user:// as { path, name, kind }
await vfs.search("foo", "./assets"); // recursively search entries under user://assets
```

Relative paths default to `user://`; absolute external URLs passed to `getUrl` pass through unchanged. `list` is non-recursive and returns entries with full VFS paths, names, and file or directory kinds. `search` is case-insensitive, recursive, and returns matching entries in the same shape. Both methods traverse linked local folders after permission has been granted.
