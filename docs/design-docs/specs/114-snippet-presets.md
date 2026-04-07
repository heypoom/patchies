# 114. Snippet Presets & Cross-Patch Portability

## Problem

GLSL effect files and Hydra snippets (spec 112) live in the patch's VFS. They can't be reused across patches. A user who builds a library of useful GLSL functions or Hydra transforms has to manually copy files between patches.

Node presets already solve this for nodes — save once, use anywhere. But there's no equivalent for code snippets (`#include` files, `@hydra` functions).

## Solution

Extend the preset system to support **snippet presets** — presets that store GLSL/Hydra files instead of node configurations. Importing a snippet preset copies files into the patch's VFS, where the existing `#include` and `@hydra` mechanisms resolve them.

## How It Works

### Saving a Snippet Preset

From VFS, the user selects a file or folder and saves it as a preset:

- **Single file**: `user://effects/chromatic-aberration.glsl` → saved as a snippet preset named "chromatic-aberration"
- **Folder**: `user://hydra-effects/` → saved as a snippet preset pack named "hydra-effects" containing all files in the folder

The preset stores the file content(s) + the VFS path structure so it can be restored in another patch.

### Importing a Snippet Preset

From the object browser or preset manager, the user imports a snippet preset into their patch:

- **Single file**: Copied into the patch's VFS at the original path (e.g. `user://effects/chromatic-aberration.glsl`)
- **Folder**: All files copied into VFS preserving the folder structure

After import:
- GLSL files are available via `#include "user://..."` 
- `@hydra` files are auto-registered via `setFunction`
- No manual setup needed — just import and use

### Preset Types

Extend the existing preset type system:

| Preset type | What it stores | What "use" does |
|---|---|---|
| Node preset (existing) | Node type + code + settings | Creates a node |
| Snippet preset (new) | Single VFS file | Copies file to patch VFS |
| Snippet pack (new) | VFS folder with files | Copies folder to patch VFS |

### Storage Format

Snippet presets use the same storage mechanism as node presets (preset library store), with an additional `type` field:

```typescript
interface SnippetPreset {
  type: 'snippet';
  name: string;
  description?: string;
  category?: string;        // e.g. "GLSL Effects", "Hydra Functions"
  files: {
    path: string;           // VFS path relative to user://
    content: string;        // file content
  }[];
}
```

A single-file preset has one entry in `files`. A folder preset has multiple.

### Object Browser Integration

Snippet presets appear in the object browser alongside node presets, in their own categories:

- **GLSL Snippets** — effect files, utility functions
- **Hydra Functions** — `@hydra` snippets
- **Material Definitions** — `@slot`-annotated material files

Selecting a snippet preset from the browser imports it into the current patch's VFS (if not already present).

### Drag-Drop

Snippet presets support the same drag-drop as spec 112's VFS files:

- **Drop onto canvas** → import to VFS + create GLSL node with scaffold (for effect files)
- **Drop onto existing node** → import to VFS + insert `#include` directive (for GLSL snippets)
- **Drop onto Hydra node** → import to VFS + auto-register via `setFunction` (for `@hydra` snippets)

The import-to-VFS step happens automatically on first use.

### Community Sharing

Snippet presets are exportable/importable like node presets. A community member publishes a "Particle Effects Pack" containing:

```
hydra-effects/
  particle-swarm.glsl     // @hydra particleSwarm
  pixel-sort.glsl         // @hydra pixelSort  
  data-mosh.glsl          // @hydra dataMosh
effects/
  particle-trails.glsl    // GLSL effect
  velocity-field.glsl     // GLSL effect
```

Import the pack → all files land in VFS → Hydra functions auto-register → GLSL effects available via `#include`. One import, everything works.

## Implementation

### Preset Library Changes

- Add `'snippet'` to preset type enum
- Add `files` field to preset schema
- Snippet preset save: read file(s) from VFS, store content in preset
- Snippet preset import: write file(s) to target patch's VFS

### Object Browser Changes

- Add snippet preset categories
- Show snippet presets with a distinct icon (e.g. code file icon vs node icon)
- "Import" action instead of "Create" for snippets

### VFS Changes

- On snippet import, check for path conflicts (file already exists at target path)
- Option to overwrite or skip on conflict

## Dependencies

- Requires spec 112 (`#include` preprocessor, `@hydra` directive) for snippets to be useful
- Extends existing preset system (preset library store, object browser, drag-drop)
- No new VFS capabilities needed — just reading/writing files
