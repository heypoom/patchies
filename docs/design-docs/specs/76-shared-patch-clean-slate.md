# 76. Shared Patch Clean Slate Loading

**Status**: Implemented
**Created**: 2026-02-16

## Problem

When loading a shared patch via `?id=...`, the app first loads the user's autosaved patch from localStorage, then replaces it with the shared patch. This causes:

1. Flash of user's own patch before shared patch loads
2. `restoreFromSave()` overwrites the user's autosave with the shared patch content
3. The autosave interval can fire between load and readonly-mode activation, corrupting the user's autosave

## Solution

Add an `isSharedPatchSession` flag to `PatchManager` that:

- **Skips autosave loading** when `?id=` is present — canvas starts empty
- **Blocks all autosave writes** for the duration of the shared patch session
- **Passes `skipAutosave: true`** to `restoreFromSave()` when loading a shared patch
- **Resets on `createNewPatch()`** so autosave resumes for new patches

The flag is also reset when the user takes ownership of the patch:

- **Cancel dialog** → `cancelLoadSharedPatch()` resets flag and loads autosave
- **Save As** → `SavePatchModal.onSave` callback resets flag
- **Quick Save** → `quickSave()` resets flag

## Files Changed

- `ui/src/lib/services/PatchManager.ts`
- `ui/src/lib/components/FlowCanvasInner.svelte`
